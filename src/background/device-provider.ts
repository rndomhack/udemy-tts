import { browser } from '#imports';
import type { DeviceTranslateResponse } from '../lib/types';
import type { LlmProvider, LlmRequest } from '../lib/translation/providers/types';
import { ProviderError } from '../lib/translation/providers/types';
import { ensureOffscreenDocument } from './synth';

// ブラウザ組み込みの翻訳機能を、LLM プロバイダと同じインターフェースで扱えるようにする。
// 翻訳自体は document 文脈でしか使えないため offscreen document へ委譲する。

export function createDeviceProvider(sourceLang: string, targetLang: string): LlmProvider {
  return {
    id: 'device',
    model: 'device',
    async complete(req: LlmRequest): Promise<string> {
      const entries = Object.entries(JSON.parse(req.user) as Record<string, string>);
      const translations = await delegate(
        entries.map(([, text]) => text),
        sourceLang,
        targetLang,
      );
      return JSON.stringify({
        translations: entries.map(([index], i) => ({
          index: Number(index),
          translation: translations[i],
        })),
        pronunciation_map: [],
      });
    },
  };
}

async function delegate(
  texts: string[],
  sourceLang: string,
  targetLang: string,
): Promise<string[]> {
  await ensureOffscreenDocument();
  const res = (await browser.runtime.sendMessage({
    type: 'OFFSCREEN_TRANSLATE',
    texts,
    sourceLang,
    targetLang,
  })) as DeviceTranslateResponse | undefined;
  if (!res?.success || !res.translations) {
    throw new ProviderError(res?.error ?? 'No response from offscreen document');
  }
  return res.translations;
}
