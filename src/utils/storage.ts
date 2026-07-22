import { browser, storage } from '#imports';
import { DEFAULT_SETTINGS, DEFAULT_VOICES, LANGUAGES } from '../lib/constants';
import type { ExtensionSettings, ProviderConfig, ProviderId } from '../lib/types';

// 設定の保存・読み込み。1 つのアイテムに全設定を持つ

/** ブラウザの UI 言語から、翻訳先と音声の初期値を決める */
function localeAwareDefaults(): ExtensionSettings {
  let lang = 'en';
  try {
    const ui = browser.i18n?.getUILanguage?.() ?? navigator.language ?? 'en';
    const code = ui.split(/[-_]/)[0].toLowerCase();
    if (LANGUAGES.some((l) => l.code === code)) lang = code;
  } catch {
    // テスト環境等
  }
  return {
    ...DEFAULT_SETTINGS,
    targetLanguage: lang,
    ttsVoice: DEFAULT_VOICES[lang] ?? DEFAULT_VOICES.en,
  };
}

export const settingsStorage = storage.defineItem<ExtensionSettings>('sync:settings', {
  fallback: localeAwareDefaults(),
});

/** 保存値をデフォルトへ重ねる。項目が増えても既存ユーザーで欠けが出ないよう、入れ子も 1 項目ずつ補う */
export function mergeSettings(
  stored: Partial<ExtensionSettings> | null | undefined,
): ExtensionSettings {
  const defaults = localeAwareDefaults();
  const providers = Object.fromEntries(
    (Object.keys(defaults.providers) as ProviderId[]).map((id) => [
      id,
      { ...defaults.providers[id], ...stored?.providers?.[id] },
    ]),
  ) as Record<ProviderId, ProviderConfig>;
  return {
    ...defaults,
    ...(stored ?? {}),
    providers,
    voicevox: { ...defaults.voicevox, ...stored?.voicevox },
    subtitleStyle: { ...defaults.subtitleStyle, ...stored?.subtitleStyle },
  };
}

export async function getSettings(): Promise<ExtensionSettings> {
  return mergeSettings(await settingsStorage.getValue());
}
