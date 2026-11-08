// A product source is anything that can search Taobao/Tmall/1688 and return item details.
// Keep the rest of the app talking to this interface only, so you can swap
// providers (Onebound, OTAPI, Yiwugo, or the official Taobao Open Platform later)
// without touching pricing, translation or the storefront.

export interface SourceSku {
  skuId: string;
  /** Option names as the seller wrote them, e.g. { "长度": "18寸" } */
  props: Record<string, string>;
  priceCny: number;
  stock?: number;
}

export interface SourceItem {
  sourceId: string; // Taobao num_iid
  source: 'taobao' | 'tmall' | '1688';
  titleZh: string;
  descriptionZh?: string;
  priceCny: number; // lowest SKU price
  images: string[];
  skus: SourceSku[];
  /** Kilograms. Providers often return this; if missing, set per category in admin. */
  weightKg?: number;
  sellerName?: string;
  sellerId?: string;
  url: string;
}

export interface SourceSearchResult {
  items: Pick<SourceItem, 'sourceId' | 'titleZh' | 'priceCny' | 'images' | 'url'>[];
  page: number;
  total?: number;
}

export interface ProductSource {
  readonly isSample?: boolean;
  search(queryZh: string, page?: number): Promise<SourceSearchResult>;
  getItem(sourceId: string): Promise<SourceItem>;
}

export const PRODUCT_SOURCE = Symbol('PRODUCT_SOURCE');
