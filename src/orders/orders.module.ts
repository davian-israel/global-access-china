import { Module } from '@nestjs/common';
import { CatalogModule } from '../catalog/catalog.module';
import { OrdersController } from './orders.controller';
import { OrdersService } from './orders.service';
import { PaystackService } from './paystack.service';

@Module({
  imports: [CatalogModule],
  controllers: [OrdersController],
  providers: [OrdersService, PaystackService],
  exports: [OrdersService],
})
export class OrdersModule {}
