import { Injectable, ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createHmac, timingSafeEqual } from 'crypto';

const API = process.env.PAYSTACK_API_BASE || 'https://api.paystack.co';

@Injectable()
export class PaystackService {
  private readonly secret?: string;

  constructor(config: ConfigService) {
    this.secret = config.get('PAYSTACK_SECRET_KEY') || undefined;
  }

  get enabled() {
    return !!this.secret;
  }

  private headers() {
    if (!this.secret) throw new ServiceUnavailableException('Payments are not switched on yet.');
    return { Authorization: `Bearer ${this.secret}`, 'Content-Type': 'application/json' };
  }

  async initialize(p: {
    email: string;
    amountMinor: number;
    currency: string;
    reference: string;
    callbackUrl: string;
    metadata: Record<string, any>;
  }): Promise<{ authorizationUrl: string; accessCode: string }> {
    const res = await fetch(`${API}/transaction/initialize`, {
      method: 'POST',
      headers: this.headers(),
      body: JSON.stringify({
        email: p.email,
        amount: p.amountMinor,
        currency: p.currency,
        reference: p.reference,
        callback_url: p.callbackUrl,
        channels: ['mobile_money', 'card'],
        metadata: p.metadata,
      }),
    });
    const body = await res.json().catch(() => ({}));
    if (!res.ok || !body.status) {
      throw new ServiceUnavailableException(`Payment could not be started: ${body.message || res.status}`);
    }
    return { authorizationUrl: body.data.authorization_url, accessCode: body.data.access_code };
  }

  async verify(reference: string): Promise<{ status: string; amount: number; currency: string; paidAt?: string }> {
    const res = await fetch(`${API}/transaction/verify/${encodeURIComponent(reference)}`, { headers: this.headers() });
    const body = await res.json().catch(() => ({}));
    if (!res.ok || !body.status) throw new ServiceUnavailableException(`Payment check failed: ${body.message || res.status}`);
    return { status: body.data.status, amount: body.data.amount, currency: body.data.currency, paidAt: body.data.paid_at };
  }

  /** Paystack signs webhooks with HMAC-SHA512 of the raw body using your secret key. */
  validSignature(raw: Buffer | undefined, signature: string | undefined) {
    if (!this.secret || !raw || !signature) return false;
    const expected = createHmac('sha512', this.secret).update(raw).digest('hex');
    const a = Buffer.from(expected);
    const b = Buffer.from(String(signature));
    return a.length === b.length && timingSafeEqual(a, b);
  }
}
