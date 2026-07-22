import type { TranslatorPersonality } from '../types';

// パーソナリティごとに system プロンプトへ差し込む指示文。

export const PERSONALITY_INSTRUCTIONS: Record<TranslatorPersonality, string> = {
  standard: '',

  concise:
    "Translate in the most compact wording that still carries the source's full meaning — " +
    'aim for clearly shorter sentences than a normal translation would use. ' +
    'Trim padding ruthlessly; never trim facts, technical terms, or caveats.',

  friendly:
    'Translate in a warm, casual tone — a knowledgeable friend explaining, not a formal ' +
    'lecturer. Use everyday spoken vocabulary, casual natural sentence endings, and ' +
    "inclusive phrasing ('let's...') when the instructor works through examples; render " +
    'fillers as casual spoken transitions. Never stiff, formal, or bureaucratic.',

  custom: '',
};
