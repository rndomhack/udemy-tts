import { beforeEach, describe, expect, it } from 'vitest';
import { buildCacheRecord } from '../lib/cache-schema';
import { cacheClear, cacheDelete, cacheGet, cacheList, cachePut } from './cache-db';

function makeRecord(lectureId: string, courseId = 'c1') {
  return buildCacheRecord(
    {
      courseId,
      lectureId,
      sourceLang: 'en',
      targetLang: 'ja',
      personality: 'standard',
      provider: 'gemini',
      model: 'm',
    },
    { courseTitle: `Course ${courseId}`, lectureTitle: `Lecture ${lectureId}` },
    ['訳文1。', '訳文2。'],
    { API: 'エーピーアイ' },
  );
}

describe('cache-db', () => {
  beforeEach(async () => {
    await cacheClear();
  });

  it('put/get roundtrip', async () => {
    const record = makeRecord('l1');
    await cachePut(record);
    const got = await cacheGet(record.key);
    expect(got?.translations).toEqual(['訳文1。', '訳文2。']);
    expect(got?.pronunciationMap).toEqual({ API: 'エーピーアイ' });
  });

  it('get returns undefined for missing key', async () => {
    expect(await cacheGet('nope')).toBeUndefined();
  });

  it('put overwrites the same key', async () => {
    const a = makeRecord('l1');
    await cachePut(a);
    await cachePut({ ...a, translations: ['更新。'], segmentCount: 1 });
    const got = await cacheGet(a.key);
    expect(got?.translations).toEqual(['更新。']);
  });

  it('list returns summaries without payload', async () => {
    await cachePut(makeRecord('l1'));
    await cachePut(makeRecord('l2', 'c2'));
    const entries = await cacheList();
    expect(entries).toHaveLength(2);
    expect((entries[0] as Record<string, unknown>).translations).toBeUndefined();
    expect(entries.map((e) => e.courseId).sort()).toEqual(['c1', 'c2']);
  });

  it('delete removes only the given keys', async () => {
    const a = makeRecord('l1');
    const b = makeRecord('l2');
    await cachePut(a);
    await cachePut(b);
    await cacheDelete([a.key]);
    expect(await cacheGet(a.key)).toBeUndefined();
    expect(await cacheGet(b.key)).toBeDefined();
  });

  it('clear removes everything', async () => {
    await cachePut(makeRecord('l1'));
    await cacheClear();
    expect(await cacheList()).toEqual([]);
  });
});
