import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ProductSource, SourceItem, SourceSearchResult } from './product-source.interface';

/**
 * Onebound-style Taobao data gateway: https://api-gw.onebound.cn/taobao/<api_name>/?key=&secret=
 * Methods used: item_search, item_get, item_list_weight.
 *
 * Field names follow Onebound's published response examples. When your key
 * arrives, call GET /api/admin/debug/raw-item/:id to see a real response and
 * adjust mapItem() if anything differs.
 */
@Injectable()
export class OneboundSource implements ProductSource {
  readonly isSample = false;
  private readonly log = new Logger(OneboundSource.name);
  private readonly base: string;
  private readonly key: string;
  private readonly secret: string;
  private readonly timeoutMs: number;
  private readonly lang: string;

  constructor(config: ConfigService) {
    this.base = config.get('TAOBAO_API_BASE', 'https://api-gw.onebound.cn');
    this.key = config.getOrThrow('TAOBAO_API_KEY');
    this.secret = config.get('TAOBAO_API_SECRET', '');
    this.timeoutMs = Number(config.get('TAOBAO_API_TIMEOUT_MS', 15000));
    // With DeepL we translate ourselves (and keep the Chinese original); without it, ask the provider for English.
    this.lang = config.get('TAOBAO_LANG') || (config.get('DEEPL_API_KEY') ? 'cn' : 'en');
  }

  async raw(path: string, params: Record<string, string>) {
    const qs = new URLSearchParams({ key: this.key, secret: this.secret, lang: this.lang, ...params });
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), this.timeoutMs);
    try {
      const res = await fetch(`${this.base}/taobao/${path}/?${qs}`, {
        signal: ctrl.signal,
        headers: { 'Accept-Encoding': 'gzip' },
      });
      if (!res.ok) throw new Error(`Taobao API ${path}: HTTP ${res.status}`);
      const body = await res.json();
      const code = body.error_code ?? '0000';
      if (code !== '0000' && code !== '2000') {
        throw new Error(`Taobao API ${path}: ${body.error || body.reason || code}`);
      }
      return body;
    } finally {
      clearTimeout(t);
    }
  }

  async search(queryZh: string, page = 1): Promise<SourceSearchResult> {
    const body = await this.raw('item_search', { q: queryZh, page: String(page) });
    const list: any[] = body.items?.item ?? [];
    return {
      page,
      total: Number(body.items?.real_total_results ?? list.length),
      items: list
        .filter((it) => it && it.num_iid)
        .map((it) => ({
          sourceId: String(it.num_iid),
          titleZh: it.title,
          priceCny: Number(it.promotion_price || it.price),
          images: [this.fixUrl(it.pic_url)].filter(Boolean),
          url: it.detail_url ?? `https://item.taobao.com/item.htm?id=${it.num_iid}`,
        })),
    };
  }

  async getItem(sourceId: string): Promise<SourceItem> {
    const body = await this.raw('item_get', { num_iid: sourceId, is_promotion: '1' });
    if (!body.item) throw new Error('item-not-found');
    const item = this.mapItem(body.item);
    if (!item.weightKg) item.weightKg = await this.weight(sourceId);
    return item;
  }

  private async weight(sourceId: string): Promise<number | undefined> {
    try {
      const body = await this.raw('item_list_weight', { num_iids: sourceId });
      const row = (body.items?.item ?? body.items ?? [])[0];
      const w = Number(row?.weight);
      if (!Number.isFinite(w) || w <= 0) return undefined;
      return row?.unit === 'g' ? w / 1000 : w;
    } catch (e) {
      this.log.warn(`weight lookup failed for ${sourceId}: ${e}`);
      return undefined;
    }
  }

  private mapItem(it: any): SourceItem {
    const skus = (it.skus?.sku ?? []).map((s: any) => ({
      skuId: String(s.sku_id),
      props: this.parseProps(s.properties_name),
      priceCny: Number(s.promotion_price || s.price),
      stock: s.quantity !== undefined ? Number(s.quantity) : undefined,
    }));
    const prices = skus.map((s) => s.priceCny).filter((n) => n > 0);
    const weight = Number(it.item_weight || it.weight);
    return {
      sourceId: String(it.num_iid),
      source: 'taobao',
      titleZh: it.title,
      descriptionZh: it.desc_short || undefined,
      priceCny: prices.length ? Math.min(...prices) : Number(it.promotion_price || it.price),
      images: (it.item_imgs ?? []).map((i: any) => this.fixUrl(i.url)).filter(Boolean),
      skus,
      weightKg: Number.isFinite(weight) && weight > 0 ? weight : undefined,
      sellerName: it.nick ?? it.seller_info?.shop_name,
      sellerId: it.seller_id ? String(it.seller_id) : it.nick,
      url: it.detail_url ?? `https://item.taobao.com/item.htm?id=${it.num_iid}`,
    };
  }

  /** "1627207:28320:颜色分类:黑色;20509:28314:尺码:M" -> { 颜色分类: 黑色, 尺码: M } */
  private parseProps(raw?: string): Record<string, string> {
    const out: Record<string, string> = {};
    for (const part of (raw ?? '').split(';')) {
      const bits = part.split(':');
      if (bits.length >= 4) out[bits[2]] = bits.slice(3).join(':');
    }
    return out;
  }

  private fixUrl(u?: string) {
    if (!u) return '';
    return u.startsWith('//') ? `https:${u}` : u;
  }
}
