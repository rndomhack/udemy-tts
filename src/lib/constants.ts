import type { ExtensionSettings, ProviderId, SubtitleStyle } from './types';

// 拡張全体で使う定数と、それを引く補助関数。
// モデルの改廃や既定値の変更はこのファイルだけで行う。

export interface ModelPreset {
  id: string;
  label: string;
  reasoning?: string;
  noteKey: string;
}

// プリセット表示するモデル (低料金・高速なものだけ)。reasoning は各モデルの既定値
export const MODEL_PRESETS: Record<
  Exclude<ProviderId, 'openai-compatible' | 'device'>,
  ModelPreset[]
> = {
  gemini: [
    {
      id: 'gemini-3.1-flash-lite',
      label: 'Gemini 3.1 Flash Lite',
      reasoning: 'minimal',
      noteKey: 'gemini31FlashLite',
    },
    {
      id: 'gemini-3.5-flash-lite',
      label: 'Gemini 3.5 Flash Lite',
      reasoning: 'minimal',
      noteKey: 'gemini35FlashLite',
    },
    { id: 'gemma-4-31b-it', label: 'Gemma 4 31B IT', reasoning: 'minimal', noteKey: 'gemma431bIt' },
  ],
  openai: [
    { id: 'gpt-5.4-mini', label: 'GPT-5.4 mini', reasoning: 'low', noteKey: 'gpt54Mini' },
    { id: 'gpt-5.4-nano', label: 'GPT-5.4 nano', reasoning: 'low', noteKey: 'gpt54Nano' },
  ],
  openrouter: [
    {
      id: 'deepseek/deepseek-v4-flash',
      label: 'DeepSeek V4 Flash',
      reasoning: 'none',
      noteKey: 'deepseekV4Flash',
    },
    { id: 'qwen/qwen3.6-flash', label: 'Qwen 3.6 Flash', reasoning: 'none', noteKey: 'qwen36Flash' },
  ],
};

export function findModelReasoning(
  provider: Exclude<ProviderId, 'openai-compatible' | 'device'>,
  model: string,
): string | undefined {
  return MODEL_PRESETS[provider].find((p) => p.id === model)?.reasoning;
}

export function isMtProvider(id: ProviderId): id is 'device' {
  return id === 'device';
}

export const LANGUAGES: Array<{ code: string; name: string }> = [
  { code: 'en', name: 'English' },
  { code: 'ar', name: 'Arabic' },
  { code: 'bg', name: 'Bulgarian' },
  { code: 'cs', name: 'Czech' },
  { code: 'da', name: 'Danish' },
  { code: 'de', name: 'German' },
  { code: 'el', name: 'Greek' },
  { code: 'es', name: 'Spanish' },
  { code: 'et', name: 'Estonian' },
  { code: 'fi', name: 'Finnish' },
  { code: 'fr', name: 'French' },
  { code: 'he', name: 'Hebrew' },
  { code: 'hi', name: 'Hindi' },
  { code: 'hu', name: 'Hungarian' },
  { code: 'id', name: 'Indonesian' },
  { code: 'it', name: 'Italian' },
  { code: 'ja', name: 'Japanese' },
  { code: 'ko', name: 'Korean' },
  { code: 'lt', name: 'Lithuanian' },
  { code: 'lv', name: 'Latvian' },
  { code: 'ms', name: 'Malay' },
  { code: 'nl', name: 'Dutch' },
  { code: 'pl', name: 'Polish' },
  { code: 'pt', name: 'Portuguese' },
  { code: 'ro', name: 'Romanian' },
  { code: 'ru', name: 'Russian' },
  { code: 'sk', name: 'Slovak' },
  { code: 'sv', name: 'Swedish' },
  { code: 'th', name: 'Thai' },
  { code: 'tr', name: 'Turkish' },
  { code: 'uk', name: 'Ukrainian' },
  { code: 'vi', name: 'Vietnamese' },
  { code: 'zh', name: 'Simplified Chinese' },
  { code: 'zh-TW', name: 'Traditional Chinese' },
];

export function languageName(code: string): string {
  return LANGUAGES.find((l) => l.code === code)?.name ?? code;
}

export const DEFAULT_VOICES: Record<string, string> = {
  en: 'en-US-AriaNeural',
  ar: 'ar-SA-ZariyahNeural',
  bg: 'bg-BG-KalinaNeural',
  cs: 'cs-CZ-VlastaNeural',
  da: 'da-DK-ChristelNeural',
  de: 'de-DE-KatjaNeural',
  el: 'el-GR-AthinaNeural',
  es: 'es-ES-ElviraNeural',
  et: 'et-EE-AnuNeural',
  fi: 'fi-FI-NooraNeural',
  fr: 'fr-FR-DeniseNeural',
  he: 'he-IL-HilaNeural',
  hi: 'hi-IN-SwaraNeural',
  hu: 'hu-HU-NoemiNeural',
  id: 'id-ID-GadisNeural',
  it: 'it-IT-ElsaNeural',
  ja: 'ja-JP-NanamiNeural',
  ko: 'ko-KR-SunHiNeural',
  lt: 'lt-LT-OnaNeural',
  lv: 'lv-LV-EveritaNeural',
  ms: 'ms-MY-YasminNeural',
  nl: 'nl-NL-ColetteNeural',
  pl: 'pl-PL-ZofiaNeural',
  pt: 'pt-BR-FranciscaNeural',
  ro: 'ro-RO-AlinaNeural',
  ru: 'ru-RU-SvetlanaNeural',
  sk: 'sk-SK-ViktoriaNeural',
  sv: 'sv-SE-SofieNeural',
  th: 'th-TH-PremwadeeNeural',
  tr: 'tr-TR-EmelNeural',
  uk: 'uk-UA-PolinaNeural',
  vi: 'vi-VN-HoaiMyNeural',
  zh: 'zh-CN-XiaoxiaoNeural',
  'zh-TW': 'zh-TW-HsiaoChenNeural',
};

export const UDEMY_LOCALE_MAP: Record<string, string> = {
  en: 'en_US',
  ar: 'ar_AR',
  bg: 'bg_BG',
  cs: 'cs_CZ',
  da: 'da_DK',
  de: 'de_DE',
  el: 'el_GR',
  es: 'es_ES',
  et: 'et_EE',
  fi: 'fi_FI',
  fr: 'fr_FR',
  he: 'he_IL',
  hi: 'hi_IN',
  hu: 'hu_HU',
  id: 'id_ID',
  it: 'it_IT',
  ja: 'ja_JP',
  ko: 'ko_KR',
  lt: 'lt_LT',
  lv: 'lv_LV',
  ms: 'ms_MY',
  nl: 'nl_NL',
  pl: 'pl_PL',
  pt: 'pt_BR',
  ro: 'ro_RO',
  ru: 'ru_RU',
  sk: 'sk_SK',
  sv: 'sv_SE',
  th: 'th_TH',
  tr: 'tr_TR',
  uk: 'uk_UA',
  vi: 'vi_VN',
  zh: 'zh_CN',
  'zh-TW': 'zh_TW',
};

export const MERGE_MAX_CUES = 10;

export const TRANSLATE_CHUNK_SIZE = 100;
export const TRANSLATE_MAX_RETRIES = 2;
export const TRANSLATE_MAX_OUTPUT_TOKENS = 16_384;

export const MAX_PLAYBACK_RATE = 4.0;
export const RATE_STEP_PER_TICK = 0.05;
export const RATE_TICK_MS = 1000;
export const SEEK_THRESHOLD_SEC = 2.0;
export const TTS_AUDIO_BYTES_PER_SEC = 6000;

export const RATE_LAG_GAIN_NATURAL = 0.1;
export const RATE_LAG_GAIN_STRONG = 0.2;
export const RATE_LOOKAHEAD_NATURAL = 10;
export const RATE_LOOKAHEAD_STRONG = 1;
export const RATE_LAG_BOOST_SEC_NATURAL = 3;
export const RATE_LAG_BOOST_SEC_STRONG = 1;
export const RATE_STEP_BOOST_FACTOR_NATURAL = 1.5;
export const RATE_STEP_BOOST_FACTOR_STRONG = 2;
export const RATE_MAX_ALLOWANCE_SEC = 5;
export const SYNTH_MAX_ATTEMPTS = 2;
export const PREFETCH_AHEAD = 4;

export const DEFAULT_SUBTITLE_STYLE: SubtitleStyle = {
  fontSize: 24,
  textColor: '#ffffff',
  backgroundColor: 'rgba(0, 0, 0, 0.75)',
};

export const DEFAULT_SETTINGS: ExtensionSettings = {
  activeProvider: 'gemini',
  providers: {
    gemini: { apiKey: '', model: MODEL_PRESETS.gemini[0].id },
    openai: { apiKey: '', model: MODEL_PRESETS.openai[0].id },
    openrouter: {
      apiKey: '',
      model: MODEL_PRESETS.openrouter[0].id,
      sort: 'throughput',
      extraBody: '',
    },
    'openai-compatible': { apiKey: '', model: '', baseUrl: '', extraBody: '', useJsonSchema: false },
    device: { apiKey: '', model: 'device' },
  },
  targetLanguage: 'en',
  translatorPersonality: 'standard',
  customPersonality: '',
  enabled: true,
  translateEnabled: true,
  ttsEnabled: true,
  ttsProvider: 'edge',
  voicevox: { baseUrl: 'http://127.0.0.1:50021', speaker: 3 },
  ttsVoice: DEFAULT_VOICES.en,
  ttsRate: 1.0,
  ttsPitch: 1.0,
  ttsVolume: 1.0,
  autoRateAdjust: true,
  autoRateMode: 'natural',
  customWords: {},
  logLevel: 'error',
  subtitleOverlayEnabled: false,
  subtitleStyle: DEFAULT_SUBTITLE_STYLE,
  subtitlePosition: null,
};
