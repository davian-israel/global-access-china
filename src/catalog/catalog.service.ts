import { BadRequestException, Inject, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { DbService } from '../db/db.service';
import { PRODUCT_SOURCE, ProductSource, SourceItem } from './product-source.interface';
import { TranslationService } from './translation.service';
import { PricingService } from './pricing.service';
import { SampleSource } from './sample.source';

// Brand words we never list (counterfeit risk, customs seizures).
const BLOCKED = [
  'nike', 'adidas', 'gucci', 'louis vuitton', 'chanel', 'prada', 'dior', 'balenciaga', 'rolex',
  'apple', 'iphone', 'airpods', 'samsung', 'supreme', 'yeezy', 'jordan', 'versace', 'hermes',
  '耐克', '阿迪', '古驰', '香奈儿', '路易威登', '苹果', '劳力士', '巴黎世家', '迪奥', '普拉达',
];

export interface ProductView {
  id: string;
  title: string;
  titleZh: string;
  description: string | null;
  category: string | null;
  priceUsd: number;
  images: string[];
  skus: { skuId: string; options: Record<string, string>; priceUsd: number; inStock: boolean }[];
  weightKg: number;
  weightEstimated: boolean;
  airHintUsd: number;
  sellerId: string | null;
  sourceUrl: string | null;
  sample: boolean;
}

@Injectable()
export class CatalogService {
  private readonly log = new Logger(CatalogService.name);
  private readonly cacheHours: number;
  private readonly defaultKg: number;

  constructor(
    @Inject(PRODUCT_SOURCE) private readonly source: ProductSource & { isSample?: boolean },
    private readonly tr: TranslationService,
    private readonly pricing: PricingService,
    private readonly db: DbService,
    config: ConfigService,
  ) {
    this.cacheHours = Number(config.get('PRODUCT_CACHE_HOURS', 6));
    this.defaultKg = Number(config.get('DEFAULT_WEIGHT_KG', 0.5));
  }

  get isSample() {
    return !!this.source.isSample;
  }

  async search(queryEn: string, page = 1) {
    const q = (queryEn ?? '').slice(0, 120);
    if (!q.trim()) throw new BadRequestException('Type something to search for.');
    const queryZh = this.isSample ? q : await this.tr.toChinese(q);
    const res = await this.source.search(queryZh, page);
    const items = [];
    for (const it of res.items) {
      const title = this.isSample
        ? (this.source as unknown as SampleSource).english(it.sourceId)?.title ?? it.titleZh
        : await this.tr.toEnglish(it.titleZh);
      if (this.blocked(title, it.titleZh)) continue;
      items.push({ id: it.sourceId, title, priceUsd: this.pricing.itemPriceUsd(it.priceCny), image: it.images[0] ?? null });
    }
    return { query: q, queryZh, page, total: res.total, items, sample: this.isSample };
  }

  async featured() {
    if (this.isSample) {
      const res = await this.source.search('', 1);
      return Promise.all(res.items.slice(0, 16).map((i) => this.getProduct(i.sourceId)));
    }
    // Live mode: show the most recently viewed real products.
    const rows = await this.db.query<{ id: string }>('select id from products order by fetched_at desc limit 12');
    const out = [];
    for (const r of rows) {
      try {
        out.push(await this.getProduct(r.id));
      } catch {
        /* skip items that disappeared */
      }
    }
    return out;
  }

  async getProduct(id: string, fresh = false): Promise<ProductView> {
    if (!/^[\w-]{1,40}$/.test(id)) throw new BadRequestException('Invalid product id.');
    if (!fresh) {
      const hit = await this.db.one<{ data: ProductView }>(
        `select data from products where id = $1 and fetched_at > now() - ($2 || ' hours')::interval`,
        [id, String(this.cacheHours)],
      );
      if (hit) return hit.data;
    }
    let it: SourceItem;
    try {
      it = await this.source.getItem(id);
    } catch (e) {
      if (String(e).includes('not-found')) throw new NotFoundException('This product is no longer available.');
      throw e;
    }
    const view = await this.toView(it);
    if (this.blocked(view.title, view.titleZh)) throw new BadRequestException('This product cannot be listed.');
    await this.db.query(
      `insert into products(id, source, data, fetched_at) values ($1, $2, $3, now())
       on conflict (id) do update set data = excluded.data, fetched_at = now()`,
      [view.id, it.source, JSON.stringify(view)],
    );
    return view;
  }

  async fromLink(link: string) {
    const id = this.extractId(link);
    if (!id) throw new BadRequestException('Paste a full Taobao or Tmall product link, e.g. https://item.taobao.com/item.htm?id=123456');
    return this.getProduct(id);
  }

  private async toView(it: SourceItem): Promise<ProductView> {
    const sample = this.isSample ? (this.source as unknown as SampleSource).english(it.sourceId) : null;
    const title = sample?.title ?? (await this.tr.toEnglish(it.titleZh));
    const skus = [];
    for (const s of it.skus) {
      skus.push({
        skuId: s.skuId,
        options: sample?.options?.[s.skuId] ?? (await this.tr.options(s.props)),
        priceUsd: this.pricing.itemPriceUsd(s.priceCny),
        inStock: s.stock === undefined ? true : s.stock > 0,
      });
    }
    const kg = it.weightKg && it.weightKg > 0 ? it.weightKg : this.defaultKg;
    return {
      id: it.sourceId,
      title,
      titleZh: it.titleZh,
      description: it.descriptionZh ? await this.tr.toEnglish(it.descriptionZh) : null,
      category: sample?.category ?? null,
      priceUsd: this.pricing.itemPriceUsd(it.priceCny),
      images: it.images,
      skus,
      weightKg: kg,
      weightEstimated: !(it.weightKg && it.weightKg > 0),
      airHintUsd: this.pricing.airHintUsd(kg),
      sellerId: it.sellerId ?? null,
      sourceUrl: it.url || null,
      sample: this.isSample,
    };
  }

  /** CNY price for a product/SKU, read fresh from the source at checkout so customers pay today's price. */
  async checkoutLine(productId: string, skuId: string | null) {
    const p = await this.getProduct(productId, true);
    const raw = await this.source.getItem(productId);
    let priceCny = raw.priceCny;
    let options: Record<string, string> = {};
    if (raw.skus.length) {
      const s = raw.skus.find((x) => x.skuId === skuId);
      if (!s) throw new BadRequestException(`Choose an option for "${p.title}".`);
      if (s.stock !== undefined && s.stock <= 0) throw new BadRequestException(`"${p.title}" is out of stock in that option.`);
      priceCny = s.priceCny;
      options = p.skus.find((x) => x.skuId === skuId)?.options ?? {};
    }
    return { product: p, priceCny, options };
  }

  private extractId(link: string): string | null {
    try {
      const u = new URL(String(link).trim());
      if (!/(^|\.)taobao\.com$|(^|\.)tmall\.com$/.test(u.hostname)) return null;
      const id = u.searchParams.get('id');
      return id && /^\d{5,20}$/.test(id) ? id : null;
    } catch {
      return null;
    }
  }

  private blocked(...texts: string[]) {
    const t = texts.join(' ').toLowerCase();
    return BLOCKED.some((w) => (/^[a-z ]+$/.test(w) ? new RegExp(`(^|[^a-z])${w}([^a-z]|$)`).test(t) : t.includes(w)));
  }
}
