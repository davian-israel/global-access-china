import { Body, Controller, Get, Inject, Module, Param, Patch, Query, UseGuards } from '@nestjs/common';
import { AdminGuard } from './admin.guard';
import { OrdersModule } from '../orders/orders.module';
import { OrdersService, STATUS_LABELS } from '../orders/orders.service';
import { CatalogModule } from '../catalog/catalog.module';
import { PRODUCT_SOURCE, ProductSource } from '../catalog/product-source.interface';

@Controller('admin')
@UseGuards(AdminGuard)
class AdminController {
  constructor(
    private readonly orders: OrdersService,
    @Inject(PRODUCT_SOURCE) private readonly source: ProductSource & { raw?: (p: string, q: Record<string, string>) => Promise<any> },
  ) {}

  @Get('statuses')
  statuses() {
    return STATUS_LABELS;
  }

  @Get('orders')
  list(@Query('status') status?: string) {
    return this.orders.list(status);
  }

  @Get('orders/:ref')
  get(@Param('ref') ref: string) {
    return this.orders.adminGet(ref);
  }

  @Patch('orders/:ref')
  update(@Param('ref') ref: string, @Body() body: { status?: string; note?: string; weighedKg?: number }) {
    return this.orders.adminUpdate(ref, body);
  }

  /** Shows the provider's raw response for one item, to check field mapping when a key is first added. */
  @Get('debug/raw-item/:id')
  async raw(@Param('id') id: string) {
    if (!this.source.raw) return { note: 'Sample catalogue in use; no provider connected.' };
    return this.source.raw('item_get', { num_iid: id, is_promotion: '1' });
  }
}

@Module({
  imports: [OrdersModule, CatalogModule],
  controllers: [AdminController],
  providers: [AdminGuard],
})
export class AdminModule {}
