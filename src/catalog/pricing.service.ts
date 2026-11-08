import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

/**
 * Pricing rules from the Global-AccessChina economics doc. Every rate is an
 * environment variable, so you can change prices without a code change.
 * - item price = Taobao price (CNY) x MARKUP / CNY_PER_USD
 * - air = AIR_USD_PER_KG per kg, AIR_MIN_KG minimum per order
 * - sea = SEA_FLAT_USD per order up to SEA_FLAT_MAX_CBM, then SEA_USD_PER_CBM_OVER
 * - SERVICE_FEE_USD per order; seller-to-warehouse delivery at cost per seller parcel
 */
export type ShipMethod = 'sea' | 'air';

export interface QuoteLine {
  priceCny: number;
  qty: number;
  weightKg: number;
  volumeCbm?: number;
}

@Injectable()
export class PricingService {
  constructor(private readonly config: ConfigService) {}

  num(key: string, fallback: number) {
    const v = this.config.get(key);
    const n = v === undefined || v === '' ? fallback : Number(v);
    return Number.isFinite(n) ? n : fallback;
  }

  get cnyPerUsd() {
    return this.num('CNY_PER_USD', 7.1);
  }
  get markup() {
    return this.num('MARKUP', 1.2);
  }

  itemPriceUsd(priceCny: number) {
    return this.round((priceCny * this.markup) / this.cnyPerUsd);
  }

  airHintUsd(weightKg: number) {
    return this.round(weightKg * this.num('AIR_USD_PER_KG', 15));
  }

  /** Rough volume from weight when the provider gives none (doc example: 2.2 kg ~ 0.015 CBM). */
  volumeFromWeight(kg: number) {
    return kg * this.num('VOLUME_CBM_PER_KG', 0.007);
  }

  quote(lines: QuoteLine[], method: ShipMethod, sellerParcels: number) {
    const items = lines.reduce((s, l) => s + this.itemPriceUsd(l.priceCny) * l.qty, 0);
    const itemKg = lines.reduce((s, l) => s + l.weightKg * l.qty, 0);
    const kg = itemKg + this.num('PACKING_KG_PER_ORDER', 0.3);
    const cbm = lines.reduce((s, l) => s + (l.volumeCbm ?? this.volumeFromWeight(l.weightKg)) * l.qty, 0);
    const domestic = (sellerParcels * this.num('DOMESTIC_CNY_PER_PARCEL', 5.6)) / this.cnyPerUsd;

    const minKg = this.num('AIR_MIN_KG', 0.5);
    const air = Math.max(kg, minKg) * this.num('AIR_USD_PER_KG', 15);
    const sea =
      this.num('SEA_FLAT_USD', 10) +
      Math.max(0, cbm - this.num('SEA_FLAT_MAX_CBM', 0.02)) * this.num('SEA_USD_PER_CBM_OVER', 500);
    const shipping = method === 'air' ? air : sea;
    const serviceFee = this.num('SERVICE_FEE_USD', 2);

    return {
      method,
      items: this.round(items),
      domestic: this.round(domestic),
      shipping: this.round(shipping),
      serviceFee,
      total: this.round(items + domestic + shipping + serviceFee),
      chargeableKg: this.round(method === 'air' ? Math.max(kg, minKg) : kg),
      estimatedCbm: Math.round(cbm * 1000) / 1000,
      alternatives: { sea: this.round(sea), air: this.round(air) },
    };
  }

  /** USD -> Paystack amount in the smallest unit of the charge currency (pesewas for GHS). */
  toChargeMinor(usd: number): { amount: number; currency: string } {
    const currency = this.config.get('PAYSTACK_CURRENCY', 'GHS');
    if (currency === 'USD') return { amount: Math.round(usd * 100), currency };
    const rate = this.num('GHS_PER_USD', NaN);
    if (!Number.isFinite(rate)) throw new Error('GHS_PER_USD is not set');
    return { amount: Math.round(usd * rate * 100), currency };
  }

  round(n: number) {
    return Math.round(n * 100) / 100;
  }
}
