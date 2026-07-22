import { describe, expect, it } from 'vitest';
import type { TranslatorPersonality } from '../types';
import { translateTexts } from './engine';
import type { LlmProvider, LlmRequest } from './providers/types';
import { ProviderError } from './providers/types';

// 応答を順に返すダミープロバイダ。使い切ったら最後の応答を返し続ける (リトライ回数の検証用)
function makeFakeProvider(responses: Array<string | Error>): {
  provider: LlmProvider;
  calls: LlmRequest[];
} {
  const calls: LlmRequest[] = [];
  let i = 0;
  const provider: LlmProvider = {
    id: 'gemini',
    model: 'fake',
    async complete(req) {
      calls.push(req);
      const next = responses[Math.min(i, responses.length - 1)];
      i++;
      if (next instanceof Error) throw next;
      return next;
    },
  };
  return { provider, calls };
}

function response(entries: Array<[number, string]>, pron: Record<string, string> = {}) {
  return JSON.stringify({
    translations: entries.map(([index, translation]) => ({ index, translation })),
    pronunciation_map: Object.entries(pron).map(([word, reading]) => ({ word, reading })),
  });
}

const OPTS = {
  sourceLangName: 'English',
  targetLangName: 'Japanese',
  personality: 'standard' as TranslatorPersonality,
  sleep: async () => {},
};

describe('translateTexts', () => {
  it('returns empty result for empty input without calling the provider', async () => {
    const { provider, calls } = makeFakeProvider([]);
    const result = await translateTexts(provider, [], OPTS);
    expect(result.translations).toEqual([]);
    expect(calls).toHaveLength(0);
  });

  it('translates a complete batch in one call', async () => {
    const { provider, calls } = makeFakeProvider([
      response([[0, 'あ'], [1, 'い']], { API: 'エーピーアイ' }),
    ]);
    const result = await translateTexts(provider, ['a', 'b'], OPTS);
    expect(result.translations).toEqual(['あ', 'い']);
    expect(result.pronunciationMap).toEqual({ API: 'エーピーアイ' });
    expect(calls).toHaveLength(1);
    expect(JSON.parse(calls[0].user)).toEqual({ '0': 'a', '1': 'b' });
  });

  it('retries the whole chunk when indices are missing (merged sentences)', async () => {
    const { provider, calls } = makeFakeProvider([
      response([[0, 'あといが結合']]),
      response([[0, 'あ'], [1, 'い']]),
    ]);
    const result = await translateTexts(provider, ['a', 'b'], OPTS);
    expect(result.translations).toEqual(['あ', 'い']);
    expect(calls).toHaveLength(2);
    expect(calls[1].user).toBe(calls[0].user);
  });

  it('throws when indices are still missing after max retries (no original fallback)', async () => {
    const { provider, calls } = makeFakeProvider([
      response([[0, 'あ']]),
    ]);
    await expect(
      translateTexts(provider, ['a', 'b'], { ...OPTS, maxRetries: 2 }),
    ).rejects.toThrow(/incomplete/i);
    expect(calls).toHaveLength(3);
  });

  it('retries on retryable provider errors with backoff', async () => {
    const { provider, calls } = makeFakeProvider([
      new ProviderError('rate limited', 429, true),
      response([[0, 'あ']]),
    ]);
    const result = await translateTexts(provider, ['a'], OPTS);
    expect(result.translations).toEqual(['あ']);
    expect(calls).toHaveLength(2);
  });

  it('throws immediately on non-retryable errors (no original fallback)', async () => {
    const { provider, calls } = makeFakeProvider([
      new ProviderError('bad api key', 401, false),
    ]);
    await expect(translateTexts(provider, ['a', 'b'], OPTS)).rejects.toThrow('bad api key');
    expect(calls).toHaveLength(1);
  });

  it('splits into chunks with absolute indices', async () => {
    const { provider, calls } = makeFakeProvider([]);
    let call = 0;
    provider.complete = async (req) => {
      calls.push(req);
      call++;
      const input = JSON.parse(req.user) as Record<string, string>;
      return response(Object.keys(input).map((k) => [Number(k), `訳${k}`]));
    };
    const result = await translateTexts(provider, ['a', 'b', 'c', 'd', 'e'], {
      ...OPTS,
      chunkSize: 2,
    });
    expect(call).toBe(3);
    expect(result.translations).toEqual(['訳0', '訳1', '訳2', '訳3', '訳4']);
    expect(JSON.parse(calls[2].user)).toEqual({ '4': 'e' });
  });

  it('merges pronunciation maps first-wins across chunks', async () => {
    const { provider } = makeFakeProvider([]);
    provider.complete = async (req) => {
      const input = JSON.parse(req.user) as Record<string, string>;
      const indices = Object.keys(input).map(Number);
      return response(
        indices.map((i) => [i, `訳${i}`]),
        indices[0] === 0 ? { API: '最初' } : { API: '後勝ちしない', GCP: 'ジーシーピー' },
      );
    };
    const result = await translateTexts(provider, ['a', 'b'], { ...OPTS, chunkSize: 1 });
    expect(result.pronunciationMap).toEqual({ API: '最初', GCP: 'ジーシーピー' });
  });
});
