import { describe, expect, it } from 'vitest';
import type { AudioQuery } from './voicevox';
import { flattenSpeakers, mergeQueries, splitSentences } from './voicevox';

describe('flattenSpeakers', () => {
  it('flattens speakers and styles into labeled entries', () => {
    const json = [
      {
        name: 'ずんだもん',
        styles: [
          { id: 3, name: 'ノーマル' },
          { id: 1, name: 'あまあま' },
        ],
      },
      { name: '四国めたん', styles: [{ id: 2, name: 'ノーマル' }] },
    ];
    expect(flattenSpeakers(json)).toEqual([
      { id: 3, name: 'ずんだもん (ノーマル)' },
      { id: 1, name: 'ずんだもん (あまあま)' },
      { id: 2, name: '四国めたん (ノーマル)' },
    ]);
  });

  it('ignores malformed input', () => {
    expect(flattenSpeakers(null)).toEqual([]);
    expect(flattenSpeakers({})).toEqual([]);
    expect(flattenSpeakers([{ name: 'x' }, { styles: [{ id: 1, name: 's' }] }])).toEqual([]);
  });
});

describe('splitSentences', () => {
  it('splits on full-width sentence endings and keeps them attached', () => {
    expect(splitSentences('これは最初の文です。これが二番目、そして三番目です。')).toEqual([
      'これは最初の文です。',
      'これが二番目、そして三番目です。',
    ]);
    expect(splitSentences('本当ですか？はい！')).toEqual(['本当ですか？', 'はい！']);
  });

  it('splits on half-width endings only before whitespace or the end of the text', () => {
    expect(splitSentences('This is one. And two.')).toEqual(['This is one.', 'And two.']);
    expect(splitSentences('バージョンは3.14です')).toEqual(['バージョンは3.14です']);
    expect(splitSentences('Node.jsとindex.htmlを使います')).toEqual([
      'Node.jsとindex.htmlを使います',
    ]);
  });

  it('returns a single sentence when there is no ending mark', () => {
    expect(splitSentences('文末記号のない断片')).toEqual(['文末記号のない断片']);
  });

  it('drops blank pieces', () => {
    expect(splitSentences('')).toEqual([]);
    expect(splitSentences('   ')).toEqual([]);
    expect(splitSentences('あああ。 　 いいい。')).toEqual(['あああ。', 'いいい。']);
  });
});

describe('mergeQueries', () => {
  const config = {
    baseUrl: 'http://127.0.0.1:50021',
    speaker: 3,
    prePhonemeLength: 0.1,
    postPhonemeLength: 0.5,
    pauseLengthScale: 0.5,
  };
  const pause = (vowel_length: number) => ({
    text: '、',
    consonant: null,
    consonant_length: null,
    vowel: 'pau',
    vowel_length,
    pitch: 0,
  });
  const query = (...phrases: AudioQuery['accent_phrases']): AudioQuery => ({
    accent_phrases: phrases,
    speedScale: 1,
    kana: 'アアア',
  });

  it('scales pauses inside a sentence and sets the sentence gap between sentences', () => {
    const merged = mergeQueries(
      [
        query({ id: 'a', pause_mora: pause(0.4) }, { id: 'b' }),
        query({ id: 'c', pause_mora: pause(0.4) }, { id: 'd' }),
      ],
      config,
    );
    expect(merged.accent_phrases).toEqual([
      { id: 'a', pause_mora: pause(0.2) },
      { id: 'b', pause_mora: pause(0.5) },
      { id: 'c', pause_mora: pause(0.2) },
      { id: 'd', pause_mora: null },
    ]);
  });

  it('applies the silence settings and neutralises the engine-side scaling', () => {
    const merged = mergeQueries([query({ id: 'a' })], config);
    expect(merged.prePhonemeLength).toBe(0.1);
    expect(merged.postPhonemeLength).toBe(0.5);
    expect(merged.pauseLength).toBeNull();
    expect(merged.pauseLengthScale).toBe(1);
    expect(merged.speedScale).toBe(1);
    expect('kana' in merged).toBe(false);
  });

  it('does not mutate the given queries', () => {
    const original = query({ id: 'a', pause_mora: pause(0.4) }, { id: 'b' });
    mergeQueries([original], config);
    expect(original.accent_phrases).toEqual([
      { id: 'a', pause_mora: pause(0.4) },
      { id: 'b' },
    ]);
  });

  it('falls back to defaults for negative and non-finite values', () => {
    const broken = {
      ...config,
      prePhonemeLength: -1,
      postPhonemeLength: NaN,
      pauseLengthScale: -0.5,
    };
    const merged = mergeQueries([query({ id: 'a', pause_mora: pause(0.4) }, { id: 'b' })], broken);
    expect(merged.prePhonemeLength).toBe(0);
    expect(merged.postPhonemeLength).toBe(0);
    expect(merged.accent_phrases[0]).toEqual({ id: 'a', pause_mora: pause(0.4) });
  });
});
