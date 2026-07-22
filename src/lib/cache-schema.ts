// 翻訳キャッシュのレコード定義とキー生成

export interface CacheKeyParts {
  courseId: string;
  lectureId: string;
  sourceLang: string;
  targetLang: string;
  personality: string;
  provider: string;
  model: string;
}

export interface CacheRecord extends CacheKeyParts {
  key: string;
  courseTitle: string;
  lectureTitle: string;
  translations: string[];
  pronunciationMap: Record<string, string>;
  segmentCount: number;
  byteSize: number;
  createdAt: number;
}

export type CacheSummary = Omit<CacheRecord, 'translations' | 'pronunciationMap'>;

/** キャッシュキーの personality 成分を返す */
export function personalityCacheKey(personality: string, customText: string): string {
  if (personality !== 'custom') return personality;
  let hash = 0x811c9dc5;
  const text = customText.trim();
  for (let i = 0; i < text.length; i++) {
    hash ^= text.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193) >>> 0;
  }
  return `custom-${hash.toString(16)}`;
}

/** 翻訳結果を左右する条件をすべて連結したキーを作る。条件が 1 つでも違えば別レコードになる */
export function buildCacheKey(p: CacheKeyParts): string {
  return [
    p.courseId,
    p.lectureId,
    p.sourceLang,
    p.targetLang,
    p.personality,
    `${p.provider}/${p.model}`,
  ].join(':');
}

export function buildCacheRecord(
  parts: CacheKeyParts,
  meta: { courseTitle: string; lectureTitle: string },
  translations: string[],
  pronunciationMap: Record<string, string>,
  now: number = Date.now(),
): CacheRecord {
  const byteSize = new TextEncoder().encode(
    JSON.stringify({ translations, pronunciationMap }),
  ).length;
  return {
    ...parts,
    key: buildCacheKey(parts),
    courseTitle: meta.courseTitle,
    lectureTitle: meta.lectureTitle,
    translations,
    pronunciationMap,
    segmentCount: translations.length,
    byteSize,
    createdAt: now,
  };
}

export function toSummary(record: CacheRecord): CacheSummary {
  const { translations: _t, pronunciationMap: _p, ...summary } = record;
  return summary;
}
