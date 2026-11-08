import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createHash } from 'crypto';
import { DbService } from '../db/db.service';

// Terms machine translation gets wrong on Taobao listings.
const GLOSSARY_ZH_EN: Record<string, string> = {
  包邮: 'free domestic shipping',
  现货: 'in stock',
  预售: 'pre-order',
  颜色分类: 'Colour',
  颜色: 'Colour',
  尺码: 'Size',
  尺寸: 'Size',
  长度: 'Length',
  规格: 'Option',
  套餐: 'Bundle',
  真人发: 'human hair',
  发帘: 'hair bundle',
};

/**
 * Chinese <-> English with a database cache, so each phrase is paid for once.
 * Uses DeepL when DEEPL_API_KEY is set; without it, text passes through unchanged
 * (fine for the sample catalogue, not for live Taobao data).
 */
@Injectable()
export class TranslationService {
  private readonly log = new Logger(TranslationService.name);
  private readonly key?: string;
  private readonly url: string;
  private ready = false;

  constructor(config: ConfigService, private readonly db: DbService) {
    this.key = config.get('DEEPL_API_KEY') || undefined;
    this.url = config.get('DEEPL_API_URL', 'https://api-free.deepl.com/v2/translate');
  }

  get enabled() {
    return !!this.key;
  }

  private async ensureTable() {
    if (this.ready) return;
    await this.db.query(
      `create table if not exists translations (k text primary key, v text not null, created_at timestamptz default now())`,
    );
    this.ready = true;
  }

  async toEnglish(zh: string): Promise<string> {
    const t = (zh ?? '').trim();
    if (!t) return '';
    if (GLOSSARY_ZH_EN[t]) return GLOSSARY_ZH_EN[t];
    if (!/[㐀-鿿]/.test(t)) return t; // already non-Chinese
    if (!this.key) return t;
    return this.cached('zh-en', t, () => this.deepl(t, 'ZH', 'EN-GB'));
  }

  async toChinese(en: string): Promise<string> {
    const t = (en ?? '').trim();
    if (!t || !this.key || /[㐀-鿿]/.test(t)) return t;
    return this.cached('en-zh', t.toLowerCase(), () => this.deepl(t, 'EN', 'ZH-HANS'));
  }

  async options(props: Record<string, string>) {
    const out: Record<string, string> = {};
    for (const [k, v] of Object.entries(props)) {
      const value = v.replace(/(\d+)\s*寸/g, '$1 inch');
      out[await this.toEnglish(k)] = await this.toEnglish(value);
    }
    return out;
  }

  private async cached(dir: string, text: string, fn: () => Promise<string>) {
    await this.ensureTable();
    const k = `${dir}:${createHash('sha1').update(text).digest('hex')}`;
    const hit = await this.db.one<{ v: string }>('select v from translations where k = $1', [k]);
    if (hit) return hit.v;
    try {
      const v = await fn();
      await this.db.query('insert into translations(k, v) values ($1, $2) on conflict (k) do nothing', [k, v]);
      return v;
    } catch (e) {
      this.log.warn(`translation failed, showing original: ${e}`);
      return text;
    }
  }

  private async deepl(text: string, source: string, target: string) {
    const res = await fetch(this.url, {
      method: 'POST',
      headers: { Authorization: `DeepL-Auth-Key ${this.key}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ text: [text], source_lang: source, target_lang: target }),
    });
    if (!res.ok) throw new Error(`DeepL HTTP ${res.status}`);
    const body = await res.json();
    return body.translations?.[0]?.text ?? text;
  }
}
