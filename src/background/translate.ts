import {
  buildCacheKey,
  buildCacheRecord,
  personalityCacheKey,
  type CacheKeyParts,
} from '../lib/cache-schema';
import { isMtProvider, languageName } from '../lib/constants';
import { createLogger } from '../lib/logger';
import { translateTexts } from '../lib/translation/engine';
import { createProvider } from '../lib/translation/providers';
import type { LlmProvider } from '../lib/translation/providers';
import type { ExtensionMessage, TestProviderResponse, TranslateResponse } from '../lib/types';
import { getSettings } from '../utils/storage';
import { cacheGet, cachePut } from './cache-db';
import { createDeviceProvider } from './device-provider';

// プロバイダを選んでセグメントを翻訳し、一括翻訳の結果だけをキャッシュに保存する

const log = createLogger('translate');

type TranslateMessage = Extract<ExtensionMessage, { type: 'TRANSLATE' }>;

export async function handleTranslate(msg: TranslateMessage): Promise<TranslateResponse> {
  const settings = await getSettings();
  const activeProvider = settings.activeProvider;
  const config = settings.providers[activeProvider];
  const mt = isMtProvider(activeProvider);
  if (!mt && !config?.apiKey) {
    log.warn('no API key configured, returning original texts');
    return { translations: msg.texts, pronunciationMap: {} };
  }

  const keyParts: CacheKeyParts | null = msg.cacheMeta
    ? {
        courseId: msg.cacheMeta.courseId,
        lectureId: msg.cacheMeta.lectureId,
        sourceLang: msg.sourceLang,
        targetLang: msg.targetLang,
        personality: personalityCacheKey(settings.translatorPersonality, settings.customPersonality),
        provider: activeProvider,
        model: config.model,
      }
    : null;

  if (keyParts) {
    try {
      const hit = await cacheGet(buildCacheKey(keyParts));
      // 字幕更新でセグメント数が変わったキャッシュは古いとみなし、使わず翻訳し直す
      if (hit && hit.translations.length === msg.texts.length) {
        log.info(`cache hit: ${hit.key}`);
        return {
          translations: hit.translations,
          pronunciationMap: hit.pronunciationMap,
          cached: true,
        };
      }
    } catch (e) {
      log.warn('cache read failed (continuing without cache):', e);
    }
  }

  if (msg.cacheOnly) return { translations: [], pronunciationMap: {}, cached: false };

  const provider: LlmProvider = mt
    ? createDeviceProvider(msg.sourceLang, msg.targetLang)
    : createProvider(activeProvider, config);
  log.info(
    `translating ${msg.texts.length} segments [${msg.sourceLang}→${msg.targetLang}] ` +
      `via ${activeProvider}/${config.model}`,
  );
  const result = await translateTexts(provider, msg.texts, {
    sourceLangName: languageName(msg.sourceLang),
    targetLangName: languageName(msg.targetLang),
    personality: settings.translatorPersonality,
    customPersonality: settings.customPersonality,
  });

  // 一括翻訳 (cacheMeta あり) のときだけ保存する。単発の翻訳はキャッシュを汚さないよう保存しない
  if (keyParts && msg.cacheMeta) {
    try {
      await cachePut(
        buildCacheRecord(keyParts, msg.cacheMeta, result.translations, result.pronunciationMap),
      );
    } catch (e) {
      log.warn('cache write failed (result still returned):', e);
    }
  }
  return result;
}

export async function handleTestProvider(): Promise<TestProviderResponse> {
  const settings = await getSettings();
  const activeProvider = settings.activeProvider;
  const config = settings.providers[activeProvider];
  const mt = isMtProvider(activeProvider);
  if (!mt && !config?.apiKey) return { success: false, errorCode: 'no-key' };
  if (!mt && !config.model) return { success: false, errorCode: 'no-model' };

  try {
    const provider = mt
      ? createDeviceProvider('en', settings.targetLanguage)
      : createProvider(activeProvider, config);
    await translateTexts(provider, ['Hello, welcome to this course!'], {
      sourceLangName: 'English',
      targetLangName: languageName(settings.targetLanguage),
      personality: settings.translatorPersonality,
      customPersonality: settings.customPersonality,
    });
    return { success: true };
  } catch (e) {
    return { success: false, error: e instanceof Error ? e.message : String(e) };
  }
}
