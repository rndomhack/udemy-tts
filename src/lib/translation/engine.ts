import {
  TRANSLATE_CHUNK_SIZE,
  TRANSLATE_MAX_OUTPUT_TOKENS,
  TRANSLATE_MAX_RETRIES,
} from '../constants';
import { createLogger } from '../logger';
import type { TranslateResponse, TranslatorPersonality } from '../types';
import { parseTranslationResponse } from './parse';
import { buildSystemPrompt, buildUserPrompt, TRANSLATION_SCHEMA } from './prompt';
import type { LlmProvider } from './providers/types';
import { ProviderError } from './providers/types';

// セグメント列をチャンクに分けて並列翻訳し、応答にインデックス欠落があればチャンク全体をやり直す

const log = createLogger('translate-engine');

export interface TranslateEngineOptions {
  sourceLangName: string;
  targetLangName: string;
  personality: TranslatorPersonality;
  customPersonality?: string;
  chunkSize?: number;
  maxRetries?: number;
  sleep?: (ms: number) => Promise<void>;
}

const defaultSleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

export async function translateTexts(
  provider: LlmProvider,
  texts: string[],
  opts: TranslateEngineOptions,
): Promise<TranslateResponse> {
  if (texts.length === 0) return { translations: [], pronunciationMap: {} };

  const chunkSize = opts.chunkSize ?? TRANSLATE_CHUNK_SIZE;
  const system = buildSystemPrompt(
    opts.sourceLangName,
    opts.targetLangName,
    opts.personality,
    opts.customPersonality,
  );

  const chunks: Array<{ offset: number; texts: string[] }> = [];
  for (let i = 0; i < texts.length; i += chunkSize) {
    chunks.push({ offset: i, texts: texts.slice(i, i + chunkSize) });
  }

  const results = await Promise.all(
    chunks.map((chunk) => translateChunk(provider, system, chunk, opts)),
  );

  const translations: string[] = [];
  const pronunciationMap: Record<string, string> = {};
  for (const result of results) {
    translations.push(...result.translations);
    for (const [word, reading] of Object.entries(result.pronunciationMap)) {
      // 同じ語の読みは先に得たものを優先する
      if (!(word in pronunciationMap)) pronunciationMap[word] = reading;
    }
  }
  return { translations, pronunciationMap };
}

async function translateChunk(
  provider: LlmProvider,
  system: string,
  chunk: { offset: number; texts: string[] },
  opts: TranslateEngineOptions,
): Promise<TranslateResponse> {
  const maxRetries = opts.maxRetries ?? TRANSLATE_MAX_RETRIES;
  const sleep = opts.sleep ?? defaultSleep;
  const indices = chunk.texts.map((_, i) => chunk.offset + i);
  const user = buildUserPrompt(chunk.texts, chunk.offset);

  const collected = new Map<number, string>();
  const pronunciationMap: Record<string, string> = {};

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    let raw: string;
    try {
      raw = await provider.complete({
        system,
        user,
        schema: TRANSLATION_SCHEMA,
        maxOutputTokens: TRANSLATE_MAX_OUTPUT_TOKENS,
      });
    } catch (e) {
      if (e instanceof ProviderError && e.retryable && attempt < maxRetries) {
        log.warn(`Provider error (attempt ${attempt + 1}), retrying:`, e.message);
        await sleep(1000 * (attempt + 1));
        continue;
      }
      throw e;
    }

    const parsed = parseTranslationResponse(raw, indices);
    for (const [idx, text] of parsed.translations) {
      collected.set(idx, text);
    }
    for (const [word, reading] of Object.entries(parsed.pronunciationMap)) {
      if (!(word in pronunciationMap)) pronunciationMap[word] = reading;
    }

    const missing = indices.filter((i) => !collected.has(i));
    if (missing.length === 0) {
      return { translations: indices.map((i) => collected.get(i)!), pronunciationMap };
    }

    // 欠落分だけ再要求すると、隣り合う文を 1 つにまとめて返されたときに文脈が壊れて欠落が固定化するため、チャンク全体をやり直す
    if (attempt < maxRetries) {
      log.warn(
        `Missing ${missing.length}/${indices.length} indices (attempt ${attempt + 1}), retrying whole chunk`,
      );
      continue;
    }

    throw new Error(
      `Translation incomplete: ${missing.length}/${indices.length} indices missing after ${maxRetries + 1} attempts`,
    );
  }

  throw new Error('Translation failed');
}
