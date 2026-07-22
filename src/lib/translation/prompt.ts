import type { TranslatorPersonality } from '../types';
import { PERSONALITY_INSTRUCTIONS } from './personalities';

// 翻訳用のプロンプトと出力スキーマを組み立てる。

export const TRANSLATION_SCHEMA = {
  type: 'object',
  properties: {
    translations: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          index: { type: 'integer' },
          translation: { type: 'string' },
        },
        required: ['index', 'translation'],
        additionalProperties: false,
      },
    },
    pronunciation_map: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          word: { type: 'string' },
          reading: { type: 'string' },
        },
        required: ['word', 'reading'],
        additionalProperties: false,
      },
    },
  },
  required: ['translations', 'pronunciation_map'],
  additionalProperties: false,
} as const;

export function buildSystemPrompt(
  sourceName: string,
  targetName: string,
  personality: TranslatorPersonality,
  customStyle = '',
): string {
  const personalityNote =
    personality === 'custom' ? customStyle.trim() : PERSONALITY_INSTRUCTIONS[personality];
  const personalitySection = personalityNote
    ? `Style (governs word choice and tone throughout):\n${personalityNote}\n\n`
    : '';
  return (
    `You are a professional ${sourceName}→${targetName} translator for educational lectures.\n\n` +
    personalitySection +
    `Input: a JSON object mapping each segment's index to its text. ` +
    `Translate every segment, keeping terminology consistent across all of them.\n\n` +
    `Rules:\n` +
    `1. The output is read aloud by TTS — write only what should be spoken. ` +
    `No parentheses, brackets, slashes, or annotations. Keep technical terms, product ` +
    `names, and code identifiers in their standard written form (one form only, never ` +
    `both scripts) — do not spell out their pronunciation in the translation; ` +
    `pronunciation_map provides readings.\n` +
    `2. Use the natural spoken register of a ${targetName} presenter addressing a live ` +
    `audience, and translate spoken fillers into natural ${targetName} equivalents.\n` +
    `3. Add punctuation at natural spoken boundaries for TTS pacing.\n` +
    `4. Return exactly one translation per input key, carrying the same index — ` +
    `never omit, merge, or duplicate entries.\n\n` +
    `After translating, identify words or short phrases in your translations that a TTS ` +
    `engine is likely to mispronounce (Latin-script words left untranslated, unusual ` +
    `acronyms, domain terms with non-obvious readings). Return them as pronunciation_map ` +
    `entries mapping each word (exactly as written in your translation) to its correct ` +
    `phonetic reading in ${targetName}. Omit anything TTS reads correctly on its own.`
  );
}

export function buildUserPrompt(texts: string[], offset: number): string {
  return JSON.stringify(Object.fromEntries(texts.map((t, i) => [String(offset + i), t])));
}

export const NO_SCHEMA_OUTPUT_FORMAT =
  `Respond with only this JSON, no code fences or commentary:\n` +
  `{"translations":[{"index":<int>,"translation":"<text>"}],` +
  `"pronunciation_map":[{"word":"<word>","reading":"<reading>"}]}`;
