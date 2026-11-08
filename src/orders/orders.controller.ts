import { Body, Controller, Get, Headers, HttpCode, Logger, Param, Post, Query, Req, Res, UnauthorizedException } from '@nestjs/common';
import type { RawBodyRequest } from '@nestjs/common';
import type { Request, Response } from 'express';
import { CreateOrderInput, OrdersService } from './orders.service';
import { PaystackService } from './paystack.service';

@Controller()
export class OrdersController {
  private readonly log = new Logger(OrdersController.name);

  constructor(private readonly orders: OrdersService, private readonly paystack: PaystackService) {}

  @Post('orders')
  create(@Body() body: CreateOrderInput) {
    return this.orders.create(body);
  }

  @Get('orders/:ref')
  view(@Param('ref') ref: string, @Query('email') email: string) {
    return this.orders.publicView(ref, email);
  }

  /** Paystack sends the customer back here after paying. */
  @Get('payments/paystack/callback')
  async callback(@Query('reference') reference: string, @Res() res: Response) {
    try {
      const order = await this.orders.confirmPayment(String(reference || ''));
      return res.redirect(`/order.html?ref=${encodeURIComponent(order.ref)}&email=${encodeURIComponent(order.email)}`);
    } catch (e) {
      this.log.warn(`callback failed for ${reference}: ${e}`);
      return res.redirect(`/order.html?ref=${encodeURIComponent(reference || '')}&error=payment`);
    }
  }

  /** Server-to-server confirmation from Paystack. Set this URL in Paystack: /api/payments/paystack/webhook */
  @Post('payments/paystack/webhook')
  @HttpCode(200)
  async webhook(@Req() req: RawBodyRequest<Request>, @Headers('x-paystack-signature') sig: string) {
    if (!this.paystack.validSignature(req.rawBody, sig)) throw new UnauthorizedException();
    const event = req.body;
    if (event?.event === 'charge.success' && event?.data?.reference) {
      await this.orders.confirmPayment(event.data.reference).catch((e) => this.log.error(`webhook confirm failed: ${e}`));
    }
    return { received: true };
  }
}
