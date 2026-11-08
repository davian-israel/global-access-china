import { Logger, Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { CatalogController } from './catalog.controller';
import { CatalogService } from './catalog.service';
import { PricingService } from './pricing.service';
import { TranslationService } from './translation.service';
import { OneboundSource } from './onebound.source';
import { SampleSource } from './sample.source';
import { PRODUCT_SOURCE } from './product-source.interface';

@Module({
  controllers: [CatalogController],
  providers: [
    PricingService,
    TranslationService,
    CatalogService,
    {
      // Live Taobao data once TAOBAO_API_KEY is set; sample catalogue until then.
      // An OTAPI adapter plugs in here the same way once OTCommerce sends its docs.
      provide: PRODUCT_SOURCE,
      inject: [ConfigService],
      useFactory: (config: ConfigService) => {
        if (config.get('TAOBAO_API_KEY')) {
          Logger.log('Product source: Onebound Taobao API', 'Catalog');
          return new OneboundSource(config);
        }
        Logger.warn('Product source: SAMPLE catalogue (set TAOBAO_API_KEY for live data)', 'Catalog');
        return new SampleSource();
      },
    },
  ],
  exports: [CatalogService, PricingService, PRODUCT_SOURCE],
})
export class CatalogModule {}
