import { describe, expect, it } from 'vitest';
import { parseTranslationResponse } from './parse';

const INDICES = [0, 1, 2];

describe('parseTranslationResponse', () => {
  it('parses the canonical array form', () => {
    const raw = JSON.stringify({
      translations: [
        { index: 0, translation: 'A' },
        { index: 1, translation: 'B' },
        { index: 2, translation: 'C' },
      ],
      pronunciation_map: [{ word: 'API', reading: 'エーピーアイ' }],
    });
    const result = parseTranslationResponse(raw, INDICES);
    expect(result.translations.get(0)).toBe('A');
    expect(result.translations.size).toBe(3);
    expect(result.pronunciationMap).toEqual({ API: 'エーピーアイ' });
  });

  it('parses the object-map form', () => {
    const raw = JSON.stringify({
      translations: { '0': 'A', '1': 'B' },
      pronunciation_map: { API: 'エーピーアイ' },
    });
    const result = parseTranslationResponse(raw, INDICES);
    expect(result.translations.get(1)).toBe('B');
    expect(result.pronunciationMap.API).toBe('エーピーアイ');
  });

  it('strips code fences', () => {
    const raw =
      '```json\n' +
      JSON.stringify({ translations: [{ index: 0, translation: 'A' }], pronunciation_map: [] }) +
      '\n```';
    const result = parseTranslationResponse(raw, INDICES);
    expect(result.translations.get(0)).toBe('A');
  });

  it('extracts JSON embedded in prose', () => {
    const raw =
      'Here is the translation:\n' +
      JSON.stringify({ translations: [{ index: 0, translation: 'A' }], pronunciation_map: [] }) +
      '\nHope this helps!';
    const result = parseTranslationResponse(raw, INDICES);
    expect(result.translations.get(0)).toBe('A');
  });

  it('ignores indices that were not requested', () => {
    const raw = JSON.stringify({
      translations: [
        { index: 0, translation: 'A' },
        { index: 99, translation: 'X' },
      ],
      pronunciation_map: [],
    });
    const result = parseTranslationResponse(raw, INDICES);
    expect(result.translations.has(99)).toBe(false);
  });

  it('drops empty-string translations', () => {
    const raw = JSON.stringify({
      translations: [{ index: 0, translation: '' }],
      pronunciation_map: [],
    });
    const result = parseTranslationResponse(raw, INDICES);
    expect(result.translations.size).toBe(0);
  });

  it('returns empty result on unparseable input', () => {
    const result = parseTranslationResponse('not json at all', INDICES);
    expect(result.translations.size).toBe(0);
    expect(result.pronunciationMap).toEqual({});
  });
});
