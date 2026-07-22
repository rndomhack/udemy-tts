import { describe, expect, it } from 'vitest';
import { buildCacheKey, buildCacheRecord, personalityCacheKey, toSummary } from './cache-schema';

const PARTS = {
  courseId: '123',
  lectureId: '456',
  sourceLang: 'en',
  targetLang: 'ja',
  personality: 'standard',
  provider: 'gemini',
  model: 'gemini-3.1-flash-lite-preview',
};

describe('cache-schema', () => {
  it('builds a stable key', () => {
    expect(buildCacheKey(PARTS)).toBe(
      '123:456:en:ja:standard:gemini/gemini-3.1-flash-lite-preview',
    );
  });

  it('builds a record with byte size and count', () => {
    const record = buildCacheRecord(
      PARTS,
      { courseTitle: 'Course', lectureTitle: 'Lecture 1' },
      ['こんにちは。', '始めましょう。'],
      { API: 'エーピーアイ' },
      1000,
    );
    expect(record.key).toBe(buildCacheKey(PARTS));
    expect(record.segmentCount).toBe(2);
    expect(record.byteSize).toBeGreaterThan(0);
    expect(record.createdAt).toBe(1000);
  });

  it('personalityCacheKey passes presets through unchanged', () => {
    expect(personalityCacheKey('standard', '')).toBe('standard');
    expect(personalityCacheKey('concise', 'ignored')).toBe('concise');
  });

  it('personalityCacheKey distinguishes custom instructions by content', () => {
    const a = personalityCacheKey('custom', 'Formal tone.');
    const b = personalityCacheKey('custom', 'Casual tone.');
    expect(a).toMatch(/^custom-[0-9a-f]+$/);
    expect(a).not.toBe(b);
    expect(personalityCacheKey('custom', '  Formal tone.  ')).toBe(a);
  });

  it('toSummary drops payload fields', () => {
    const record = buildCacheRecord(
      PARTS,
      { courseTitle: 'c', lectureTitle: 'l' },
      ['a'],
      {},
    );
    const summary = toSummary(record) as Record<string, unknown>;
    expect(summary.translations).toBeUndefined();
    expect(summary.pronunciationMap).toBeUndefined();
    expect(summary.key).toBe(record.key);
  });
});
