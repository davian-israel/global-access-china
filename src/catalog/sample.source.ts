import { Injectable } from '@nestjs/common';
import { ProductSource, SourceItem, SourceSearchResult } from './product-source.interface';

/**
 * Sample catalogue used until a Taobao data key is configured (TAOBAO_API_KEY unset).
 * These are illustrative listings, not live Taobao items; checkout stays switched off
 * while this source is active, so nobody can pay for them.
 */
type Sample = SourceItem & { titleEn: string; category: string; optionsEn?: Record<string, Record<string, string>> };

const S = (
  id: string,
  category: string,
  titleZh: string,
  titleEn: string,
  priceCny: number,
  weightKg: number,
  skus: { id: string; zh: Record<string, string>; en: Record<string, string>; cny: number }[] = [],
  images: string[] = [],
): Sample => ({
  sourceId: id,
  source: 'taobao',
  category,
  titleZh,
  titleEn,
  priceCny: skus.length ? Math.min(...skus.map((s) => s.cny)) : priceCny,
  images,
  weightKg,
  sellerId: `sample-seller-${id.slice(-1)}`,
  sellerName: 'Sample seller',
  url: '',
  skus: skus.map((s) => ({ skuId: s.id, props: s.zh, priceCny: s.cny, stock: 50 })),
  optionsEn: Object.fromEntries(skus.map((s) => [s.id, s.en])),
});

const IMG = '/assets/products/';

export const SAMPLES: Sample[] = [
  S('sample-1013', 'Smart wearables', '智能戒指 心率 血氧 睡眠监测 无需订阅 带充电仓', 'Smart ring with charging case, heart rate, sleep and SpO2 tracking, no subscription', 120, 0.1, [
    { id: 'r7', zh: { 尺码: '7号' }, en: { Size: '7' }, cny: 120 },
    { id: 'r8', zh: { 尺码: '8号' }, en: { Size: '8' }, cny: 120 },
    { id: 'r9', zh: { 尺码: '9号' }, en: { Size: '9' }, cny: 120 },
    { id: 'r10', zh: { 尺码: '10号' }, en: { Size: '10' }, cny: 120 },
    { id: 'r11', zh: { 尺码: '11号' }, en: { Size: '11' }, cny: 120 },
    { id: 'r12', zh: { 尺码: '12号' }, en: { Size: '12' }, cny: 120 },
  ], [IMG + 'smart-ring.svg']),
  S('sample-1014', 'Electronics', '迷你投影仪 1080P 家用 便携 自动对焦', 'Mini projector, 1080p, portable, auto focus', 320, 1.2, [
    { id: 'pw', zh: { 颜色分类: '白色' }, en: { Colour: 'White' }, cny: 320 },
    { id: 'pg', zh: { 颜色分类: '灰色' }, en: { Colour: 'Grey' }, cny: 320 },
  ], [IMG + 'mini-projector.svg']),
  S('sample-1015', 'Hair & beauty', '真人发 13x4 蕾丝前额假发 体波纹 自然黑', 'Human hair lace front wig, 13x4, body wave, natural black', 420, 0.4, [
    { id: 'w18', zh: { 长度: '18寸' }, en: { Length: '18 inch' }, cny: 420 },
    { id: 'w22', zh: { 长度: '22寸' }, en: { Length: '22 inch' }, cny: 520 },
    { id: 'w26', zh: { 长度: '26寸' }, en: { Length: '26 inch' }, cny: 640 },
  ], [IMG + 'human-hair-lace-wig.svg']),
  S('sample-1016', 'Hair & beauty', '化纤 蕾丝前额假发 短发波波头 耐高温丝', 'Synthetic lace front wig, short bob, heat resistant', 95, 0.35, [
    { id: 'sb', zh: { 颜色分类: '自然黑' }, en: { Colour: 'Natural black' }, cny: 95 },
    { id: 'sh', zh: { 颜色分类: '蜂蜜棕' }, en: { Colour: 'Honey brown' }, cny: 95 },
  ], [IMG + 'synthetic-lace-wig.svg']),
  S('sample-1001', 'Phone & accessories', '无线蓝牙耳机 主动降噪 长续航', 'Wireless earbuds, noise cancelling, long battery', 60, 0.2, [
    { id: 'k1', zh: { 颜色分类: '黑色' }, en: { Colour: 'Black' }, cny: 60 },
    { id: 'k2', zh: { 颜色分类: '白色' }, en: { Colour: 'White' }, cny: 60 },
  ]),
  S('sample-1002', 'Hair & beauty', '真人发 体波纹 发帘 自然黑', 'Human hair bundle, body wave, natural black', 180, 0.4, [
    { id: 'h14', zh: { 长度: '14寸' }, en: { Length: '14 inch' }, cny: 140 },
    { id: 'h16', zh: { 长度: '16寸' }, en: { Length: '16 inch' }, cny: 160 },
    { id: 'h18', zh: { 长度: '18寸' }, en: { Length: '18 inch' }, cny: 180 },
    { id: 'h20', zh: { 长度: '20寸' }, en: { Length: '20 inch' }, cny: 210 },
  ]),
  S('sample-1003', "Women's fashion", '夏季碎花中长连衣裙', 'Summer midi dress, floral print', 85, 0.4, [
    { id: 'S', zh: { 尺码: 'S' }, en: { Size: 'S' }, cny: 85 },
    { id: 'M', zh: { 尺码: 'M' }, en: { Size: 'M' }, cny: 85 },
    { id: 'L', zh: { 尺码: 'L' }, en: { Size: 'L' }, cny: 85 },
  ]),
  S('sample-1004', 'Home & kitchen', '厨房收纳六件套', 'Kitchen organiser set, 6 pieces', 45, 0.8),
  S('sample-1005', 'Phone & accessories', '透明防摔手机壳', 'Shockproof phone case, clear', 15, 0.05),
  S('sample-1006', 'Kids & baby', '儿童防水书包', 'Kids school backpack, waterproof', 55, 0.6),
  S('sample-1007', 'Home & kitchen', 'LED灯带 5米 遥控', 'LED strip lights, 5 m, remote control', 28, 0.3),
  S('sample-1008', 'Small appliances', '便携式榨汁机 USB充电', 'Portable blender, USB rechargeable', 120, 0.7),
  S('sample-1009', "Men's fashion", '男士休闲短袖衬衫', "Men's casual short-sleeve shirt", 69, 0.3),
  S('sample-1010', 'Solar & power', '太阳能户外庭院灯', 'Solar garden light, outdoor', 39, 0.5),
  S('sample-1011', 'Hair & beauty', '化妆刷套装 12支', 'Makeup brush set, 12 pieces', 32, 0.25),
  S('sample-1012', 'Kids & baby', '婴儿纯棉连体衣 三件装', 'Baby cotton bodysuits, pack of 3', 49, 0.3),
];

@Injectable()
export class SampleSource implements ProductSource {
  readonly isSample = true;

  async search(query: string, page = 1): Promise<SourceSearchResult> {
    const q = (query || '').toLowerCase().trim();
    const words = q.split(/\s+/).filter(Boolean);
    const hits = SAMPLES.filter((s) => {
      const hay = `${s.titleEn} ${s.titleZh} ${s.category}`.toLowerCase();
      return !words.length || words.some((w) => hay.includes(w));
    });
    return {
      page,
      total: hits.length,
      items: hits.map((s) => ({ sourceId: s.sourceId, titleZh: s.titleZh, priceCny: s.priceCny, images: s.images, url: s.url })),
    };
  }

  async getItem(sourceId: string): Promise<SourceItem> {
    const s = SAMPLES.find((x) => x.sourceId === sourceId);
    if (!s) throw new Error('item-not-found');
    return s;
  }

  /** Sample items carry their own English text, so no translation key is needed in preview mode. */
  english(sourceId: string) {
    const s = SAMPLES.find((x) => x.sourceId === sourceId);
    return s ? { title: s.titleEn, category: s.category, options: s.optionsEn ?? {} } : null;
  }
}
