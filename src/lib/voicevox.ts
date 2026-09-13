import type { VoicevoxConfig, VoicevoxSpeaker } from './types';

// VOICEVOX Engine の応答を扱う純粋ロジック。
// /speakers はスタイル単位の選択肢へ平坦化し、audio_query は文ごとに取得したものを 1 本の合成クエリへ統合する。

interface RawSpeaker {
  name?: string;
  styles?: Array<{ id?: number; name?: string }>;
}

interface PauseMora {
  text: string;
  consonant: string | null;
  consonant_length: number | null;
  vowel: string;
  vowel_length: number;
  pitch: number;
}

interface AccentPhrase {
  pause_mora?: PauseMora | null;
  [key: string]: unknown;
}

export interface AudioQuery {
  accent_phrases: AccentPhrase[];
  [key: string]: unknown;
}

const SENTENCE_END_FULL = '。｡！？؟';
const SENTENCE_END_HALF = '.!?';

/** テキストを文単位へ分割する */
export function splitSentences(text: string): string[] {
  const sentences: string[] = [];
  let start = 0;
  for (let i = 0; i < text.length; i++) {
    const char = text[i];
    // 半角の記号は小数点や識別子の区切りにも使われるため、後ろに空白か終端が続くときだけ文末とみなす
    const isEnd =
      SENTENCE_END_FULL.includes(char) ||
      (SENTENCE_END_HALF.includes(char) && (i + 1 === text.length || /\s/.test(text[i + 1])));
    if (!isEnd) continue;
    sentences.push(text.slice(start, i + 1));
    start = i + 1;
  }
  sentences.push(text.slice(start));
  return sentences.map((sentence) => sentence.trim()).filter(Boolean);
}

/** 文ごとの合成クエリを、無音の長さの設定を反映した 1 本の合成クエリへ統合する */
export function mergeQueries(queries: AudioQuery[], config: VoicevoxConfig): AudioQuery {
  const sentenceGap = nonNegative(config.postPhonemeLength, 0);
  const scale = nonNegative(config.pauseLengthScale, 1);
  const phrases: AccentPhrase[] = [];

  queries.forEach((query, queryIdx) => {
    const lastPhraseIdx = query.accent_phrases.length - 1;
    const hasNextSentence = queryIdx < queries.length - 1;
    query.accent_phrases.forEach((phrase, phraseIdx) => {
      if (phraseIdx === lastPhraseIdx) {
        phrases.push({ ...phrase, pause_mora: hasNextSentence ? sentencePause(sentenceGap) : null });
      } else if (phrase.pause_mora) {
        const vowel_length = phrase.pause_mora.vowel_length * scale;
        phrases.push({ ...phrase, pause_mora: { ...phrase.pause_mora, vowel_length } });
      } else {
        phrases.push(phrase);
      }
    });
  });

  const merged: AudioQuery = {
    ...queries[0],
    accent_phrases: phrases,
    prePhonemeLength: nonNegative(config.prePhonemeLength, 0),
    postPhonemeLength: sentenceGap,
    pauseLength: null,
    pauseLengthScale: 1,
  };
  delete merged.kana;
  return merged;
}

export function flattenSpeakers(json: unknown): VoicevoxSpeaker[] {
  if (!Array.isArray(json)) return [];
  const result: VoicevoxSpeaker[] = [];
  for (const speaker of json as RawSpeaker[]) {
    if (!speaker?.name || !Array.isArray(speaker.styles)) continue;
    for (const style of speaker.styles) {
      if (typeof style?.id !== 'number' || !style.name) continue;
      result.push({ id: style.id, name: `${speaker.name} (${style.name})` });
    }
  }
  return result;
}

function sentencePause(vowel_length: number): PauseMora {
  return { text: '、', consonant: null, consonant_length: null, vowel: 'pau', vowel_length, pitch: 0 };
}

function nonNegative(value: number, fallback: number): number {
  return Number.isFinite(value) && value >= 0 ? value : fallback;
}
