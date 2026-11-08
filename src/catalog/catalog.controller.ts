import { BadRequestException, Body, Controller, Get, Param, Post, Query } from '@nestjs/common';
import { CatalogService } from './catalog.service';
import { PricingService, ShipMethod } from './pricing.service';

@Controller('catalog')
export class CatalogController {
  constructor(private readonly catalog: CatalogService, private readonly pricing: PricingService) {}

  @Get('search')
  search(@Query('q') q: string, @Query('page') page = '1') {
    return this.catalog.search(q, Math.max(1, Math.min(50, Number(page) || 1)));
  }

  @Get('featured')
  featured() {
    return this.catalog.featured();
  }

  @Get('products/:id')
  product(@Param('id') id: string) {
    return this.catalog.getProduct(id);
  }

  @Post('from-link')
  fromLink(@Body('url') url: string) {
    return this.catalog.fromLink(url);
  }

  /** Estimate for the cart page. The order endpoint recalculates everything server-side. */
  @Post('quote')
  async quote(@Body() body: { method: ShipMethod; items: { productId: string; skuId?: string; qty: number }[] }) {
    if (!Array.isArray(body?.items) || !body.items.length || body.items.length > 50) {
      throw new BadRequestException('Your cart is empty.');
    }
    const method: ShipMethod = body.method === 'air' ? 'air' : 'sea';
    const lines = [];
    const sellers = new Set<string>();
    for (const i of body.items) {
      const p = await this.catalog.getProduct(String(i.productId));
      const sku = p.skus.find((s) => s.skuId === i.skuId);
      const usd = sku ? sku.priceUsd : p.priceUsd;
      lines.push({ priceCny: (usd * this.pricing.cnyPerUsd) / this.pricing.markup, qty: Math.max(1, Math.min(99, Number(i.qty) || 1)), weightKg: p.weightKg });
      sellers.add(p.sellerId ?? p.id);
    }
    return this.pricing.quote(lines, method, sellers.size);
  }
}
