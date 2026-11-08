import { Controller, Get, Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { ServeStaticModule } from '@nestjs/serve-static';
import { join } from 'path';
import { DbModule } from './db/db.module';
import { DbService } from './db/db.service';
import { CatalogModule } from './catalog/catalog.module';
import { OrdersModule } from './orders/orders.module';
import { AdminModule } from './admin/admin.module';
import { PricingService } from './catalog/pricing.service';

@Controller()
class HealthController {
  constructor(
    private readonly db: DbService,
    private readonly config: ConfigService,
    private readonly pricing: PricingService,
  ) {}

  @Get('health')
  async health() {
    await this.db.query('select 1');
    return { ok: true };
  }

  /** Public settings the storefront needs. No secrets here. */
  @Get('config')
  publicConfig() {
    const source = this.config.get('TAOBAO_API_KEY') ? 'taobao' : 'sample';
    const checkoutEnabled =
      source === 'taobao' && !!this.config.get('PAYSTACK_SECRET_KEY') && !!this.config.get('GHS_PER_USD');
    return {
      dataSource: source,
      checkoutEnabled,
      airUsdPerKg: this.pricing.num('AIR_USD_PER_KG', 15),
      airMinKg: this.pricing.num('AIR_MIN_KG', 0.5),
      seaFlatUsd: this.pricing.num('SEA_FLAT_USD', 10),
      serviceFeeUsd: this.pricing.num('SERVICE_FEE_USD', 2),
      ghsPerUsd: this.config.get('GHS_PER_USD') ? Number(this.config.get('GHS_PER_USD')) : null,
      whatsapp: this.config.get('SUPPORT_WHATSAPP') || null,
      pickupAddress: this.config.get('PICKUP_ADDRESS') || null,
    };
  }
}

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    ServeStaticModule.forRoot({
      rootPath: join(__dirname, '..', 'public'),
      exclude: ['/api/(.*)'],
    }),
    DbModule,
    CatalogModule,
    OrdersModule,
    AdminModule,
  ],
  controllers: [HealthController],
})
export class AppModule {}
