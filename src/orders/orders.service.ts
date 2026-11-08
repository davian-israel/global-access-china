import { BadRequestException, ForbiddenException, Injectable, Logger, NotFoundException, ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { randomBytes } from 'crypto';
import { DbService } from '../db/db.service';
import { CatalogService } from '../catalog/catalog.service';
import { PricingService, ShipMethod } from '../catalog/pricing.service';
import { PaystackService } from './paystack.service';

export const STATUSES = [
  'pending_payment',
  'paid',
  'purchased',
  'at_warehouse',
  'shipped',
  'arrived',
  'ready_for_pickup',
  'out_for_delivery',
  'delivered',
  'cancelled',
  'refunded',
] as const;
export type OrderStatus = (typeof STATUSES)[number];

export const STATUS_LABELS: Record<OrderStatus, string> = {
  pending_payment: 'Waiting for payment',
  paid: 'Paid, buying from the seller',
  purchased: 'Bought from the seller',
  at_warehouse: 'At our China warehouse',
  shipped: 'On its way to Ghana',
  arrived: 'Arrived in Ghana, clearing customs',
  ready_for_pickup: 'Ready to collect',
  out_for_delivery: 'Out for delivery',
  delivered: 'Delivered',
  cancelled: 'Cancelled',
  refunded: 'Refunded',
};

export interface CreateOrderInput {
  email: string;
  name: string;
  phone: string;
  shipMethod: ShipMethod;
  drop: 'pickup' | 'home';
  address?: string;
  items: { productId: string; skuId?: string; qty: number }[];
}

@Injectable()
export class OrdersService {
  private readonly log = new Logger(OrdersService.name);

  constructor(
    private readonly db: DbService,
    private readonly catalog: CatalogService,
    private readonly pricing: PricingService,
    private readonly paystack: PaystackService,
    private readonly config: ConfigService,
  ) {}

  private newRef() {
    const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    const bytes = randomBytes(7);
    return 'GAC-' + Array.from(bytes, (b) => alphabet[b % alphabet.length]).join('');
  }

  private clean(s: unknown, max: number) {
    return String(s ?? '').replace(/[\u0000-\u001f]/g, ' ').trim().slice(0, max);
  }

  async create(input: CreateOrderInput) {
    if (this.catalog.isSample) {
      throw new ForbiddenException('Checkout opens when live Taobao products are connected. These are sample products.');
    }
    if (!this.paystack.enabled) throw new ServiceUnavailableException('Payments are not switched on yet.');

    const email = this.clean(input.email, 200).toLowerCase();
    const name = this.clean(input.name, 120);
    const phone = this.clean(input.phone, 30);
    const shipMethod: ShipMethod = input.shipMethod === 'air' ? 'air' : 'sea';
    const drop = input.drop === 'home' ? 'home' : 'pickup';
    const address = this.clean(input.address, 400);
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) throw new BadRequestException('Enter a valid email address.');
    if (name.length < 2) throw new BadRequestException('Enter your full name.');
    if (!/^\+?[0-9 ]{9,16}$/.test(phone)) throw new BadRequestException('Enter a valid phone number.');
    if (!Array.isArray(input.items) || !input.items.length) throw new BadRequestException('Your cart is empty.');
    if (input.items.length > 50) throw new BadRequestException('Too many items in one order.');

    const homeFee = this.pricing.num('HOME_DELIVERY_USD', NaN);
    if (drop === 'home') {
      if (!Number.isFinite(homeFee)) throw new BadRequestException('Home delivery is not available yet. Choose the pickup point.');
      if (address.length < 8) throw new BadRequestException('Enter your delivery address.');
    }

    // Recalculate every price from the source; never trust prices sent by the browser.
    const lines = [];
    const sellers = new Set<string>();
    const items = [];
    for (const raw of input.items) {
      const qty = Math.max(1, Math.min(99, Math.floor(Number(raw.qty) || 1)));
      const { product, priceCny, options } = await this.catalog.checkoutLine(String(raw.productId), raw.skuId ? String(raw.skuId) : null);
      lines.push({ priceCny, qty, weightKg: product.weightKg });
      sellers.add(product.sellerId ?? product.id);
      items.push({
        productId: product.id,
        skuId: raw.skuId ?? null,
        title: product.title,
        titleZh: product.titleZh,
        options,
        qty,
        priceCny,
        unitUsd: this.pricing.itemPriceUsd(priceCny),
        weightKg: product.weightKg,
        sourceUrl: product.sourceUrl,
        image: product.images[0] ?? null,
      });
    }
    const quote: any = this.pricing.quote(lines, shipMethod, sellers.size);
    quote.lastMile = drop === 'home' ? homeFee : 0;
    quote.total = this.pricing.round(quote.total + quote.lastMile);

    const { amount, currency } = this.pricing.toChargeMinor(quote.total);
    const ref = this.newRef();
    const row = await this.db.one<{ id: number }>(
      `insert into orders(ref, status, email, name, phone, ship_method, drop_type, address, items, quote, total_usd, charge_minor, charge_currency, payment_ref)
       values ($1,'pending_payment',$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$1) returning id`,
      [ref, email, name, phone, shipMethod, drop, drop === 'home' ? address : null, JSON.stringify(items), JSON.stringify(quote), quote.total, amount, currency],
    );
    await this.event(row!.id, 'pending_payment', 'Order created');

    const publicUrl = this.config.getOrThrow<string>('PUBLIC_URL').replace(/\/$/, '');
    const pay = await this.paystack.initialize({
      email,
      amountMinor: amount,
      currency,
      reference: ref,
      callbackUrl: `${publicUrl}/api/payments/paystack/callback`,
      metadata: { order_ref: ref, total_usd: quote.total, ship_method: shipMethod },
    });
    return { ref, totalUsd: quote.total, charge: { amountMinor: amount, currency }, authorizationUrl: pay.authorizationUrl };
  }

  /** Confirms a payment with Paystack before marking the order paid. Safe to call repeatedly. */
  async confirmPayment(reference: string) {
    const order = await this.db.one('select * from orders where payment_ref = $1', [reference]);
    if (!order) throw new NotFoundException('Order not found.');
    if (order.status !== 'pending_payment') return order;
    const v = await this.paystack.verify(reference);
    if (v.status !== 'success') return order;
    if (v.amount !== order.charge_minor || v.currency !== order.charge_currency) {
      this.log.error(`Amount mismatch on ${reference}: paid ${v.amount} ${v.currency}, expected ${order.charge_minor} ${order.charge_currency}`);
      await this.event(order.id, 'pending_payment', `Payment amount mismatch: received ${v.amount} ${v.currency}. Check in Paystack.`);
      return order;
    }
    const updated = await this.db.one(
      `update orders set status='paid', paid_at=now(), updated_at=now() where id=$1 and status='pending_payment' returning *`,
      [order.id],
    );
    if (updated) await this.event(order.id, 'paid', 'Payment confirmed by Paystack');
    return updated ?? order;
  }

  async publicView(ref: string, email: string) {
    const order = await this.db.one('select * from orders where ref = $1 and lower(email) = lower($2)', [this.clean(ref, 20), this.clean(email, 200)]);
    if (!order) throw new NotFoundException('No order found with that reference and email.');
    const events = await this.db.query('select status, note, created_at from order_events where order_id=$1 order by created_at', [order.id]);
    return {
      ref: order.ref,
      status: order.status,
      statusLabel: STATUS_LABELS[order.status as OrderStatus] ?? order.status,
      shipMethod: order.ship_method,
      drop: order.drop_type,
      items: order.items.map((i: any) => ({ title: i.title, options: i.options, qty: i.qty, unitUsd: i.unitUsd })),
      quote: order.quote,
      createdAt: order.created_at,
      events: events.map((e) => ({ status: e.status, label: STATUS_LABELS[e.status as OrderStatus] ?? e.status, note: e.status === 'pending_payment' ? null : e.note, at: e.created_at })),
    };
  }

  async list(status?: string, limit = 100) {
    if (status && STATUSES.includes(status as OrderStatus)) {
      return this.db.query('select * from orders where status=$1 order by created_at desc limit $2', [status, limit]);
    }
    return this.db.query('select * from orders order by created_at desc limit $1', [limit]);
  }

  async adminGet(ref: string) {
    const order = await this.db.one('select * from orders where ref=$1', [ref]);
    if (!order) throw new NotFoundException('Order not found.');
    const events = await this.db.query('select * from order_events where order_id=$1 order by created_at', [order.id]);
    return { ...order, events };
  }

  async adminUpdate(ref: string, body: { status?: string; note?: string; weighedKg?: number }) {
    const order = await this.db.one('select * from orders where ref=$1', [ref]);
    if (!order) throw new NotFoundException('Order not found.');
    if (body.status && !STATUSES.includes(body.status as OrderStatus)) throw new BadRequestException('Unknown status.');
    if (body.status === 'paid' && order.status === 'pending_payment') {
      throw new BadRequestException('Orders are marked paid only after Paystack confirms the payment.');
    }
    const weighed = body.weighedKg !== undefined && body.weighedKg !== null ? Number(body.weighedKg) : null;
    if (weighed !== null && (!Number.isFinite(weighed) || weighed <= 0 || weighed > 500)) throw new BadRequestException('Weight looks wrong.');
    await this.db.query(
      `update orders set status=coalesce($2,status), weighed_kg=coalesce($3,weighed_kg), updated_at=now() where id=$1`,
      [order.id, body.status ?? null, weighed],
    );
    const note = this.clean(body.note, 500) || null;
    if (body.status || note || weighed !== null) {
      await this.event(order.id, body.status ?? order.status, [note, weighed !== null ? `Weighed: ${weighed} kg` : null].filter(Boolean).join(' · ') || null);
    }
    return this.adminGet(ref);
  }

  private event(orderId: number, status: string, note: string | null) {
    return this.db.query('insert into order_events(order_id, status, note) values ($1,$2,$3)', [orderId, status, note]);
  }
}
