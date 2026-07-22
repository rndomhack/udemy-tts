// 拡張全体で共有する型と、コンテキスト間でやり取りするメッセージの定義

export type ProviderId = 'gemini' | 'openai' | 'openrouter' | 'openai-compatible' | 'device';

export interface ProviderConfig {
  apiKey: string;
  model: string;
  baseUrl?: string;
  sort?: string;
  extraBody?: string;
  useJsonSchema?: boolean;
}

export type TranslatorPersonality = 'standard' | 'concise' | 'friendly' | 'custom';

export type TtsProviderId = 'edge' | 'voicevox';

export interface VoicevoxConfig {
  baseUrl: string;
  speaker: number;
}

export type AutoRateMode = 'natural' | 'strong';

export type LogLevel = 'error' | 'warn' | 'info' | 'debug';

export interface SubtitleStyle {
  fontSize: number;
  textColor: string;
  backgroundColor: string;
}

export interface SubtitlePosition {
  xRatio: number;
  yRatio: number;
}

export interface ExtensionSettings {
  activeProvider: ProviderId;
  providers: Record<ProviderId, ProviderConfig>;
  targetLanguage: string;
  translatorPersonality: TranslatorPersonality;
  customPersonality: string;
  enabled: boolean;
  translateEnabled: boolean;
  ttsEnabled: boolean;
  ttsProvider: TtsProviderId;
  voicevox: VoicevoxConfig;
  ttsVoice: string;
  ttsRate: number;
  ttsPitch: number;
  ttsVolume: number;
  autoRateAdjust: boolean;
  autoRateMode: AutoRateMode;
  customWords: Record<string, string>;
  logLevel: LogLevel;
  subtitleOverlayEnabled: boolean;
  subtitleStyle: SubtitleStyle;
  subtitlePosition: SubtitlePosition | null;
}

export interface VttCue {
  startTime: number;
  endTime: number;
  text: string;
}

export interface VttSegment {
  startTime: number;
  endTime: number;
  text: string;
}

export interface TranslateCacheMeta {
  courseId: string;
  lectureId: string;
  courseTitle: string;
  lectureTitle: string;
}

export interface SynthesizeParams {
  text: string;
  voice: string;
  rate: number;
  pitch: number;
  volume: number;
}

export interface DeviceTranslateParams {
  texts: string[];
  sourceLang: string;
  targetLang: string;
}

export type ExtensionMessage =
  | { type: 'GET_SETTINGS' }
  | {
      type: 'TRANSLATE';
      texts: string[];
      sourceLang: string;
      targetLang: string;
      cacheMeta?: TranslateCacheMeta;
      cacheOnly?: boolean;
    }
  | ({ type: 'SYNTHESIZE' } & SynthesizeParams)
  | ({ type: 'OFFSCREEN_SYNTHESIZE' } & SynthesizeParams)
  | ({ type: 'OFFSCREEN_TRANSLATE' } & DeviceTranslateParams)
  | { type: 'GET_VOICES' }
  | { type: 'OFFSCREEN_GET_VOICES' }
  | { type: 'GET_VOICEVOX_SPEAKERS' }
  | { type: 'CACHE_LIST' }
  | { type: 'CACHE_STATUS'; courseId: string; lectureId: string }
  | { type: 'CACHE_DELETE'; keys: string[] }
  | { type: 'CACHE_CLEAR' }
  | { type: 'TEST_PROVIDER' }
  | { type: 'OPEN_OPTIONS' };

export interface GetSettingsResponse {
  settings: ExtensionSettings;
}

export interface TranslateResponse {
  translations: string[];
  pronunciationMap: Record<string, string>;
  cached?: boolean;
}

export interface SynthesizeResponse {
  success: boolean;
  // Chrome は拡張メッセージで ArrayBuffer が壊れるため base64 文字列、Firefox は ArrayBuffer で渡す
  audio?: ArrayBuffer | string;
  error?: string;
}

export interface DeviceTranslateResponse {
  success: boolean;
  translations?: string[];
  error?: string;
}

export interface EdgeVoice {
  shortName: string;
  locale: string;
  gender: string;
}

export interface GetVoicesResponse {
  voices: EdgeVoice[];
}

export interface VoicevoxSpeaker {
  id: number;
  name: string;
}

export interface VoicevoxSpeakersResponse {
  success: boolean;
  speakers?: VoicevoxSpeaker[];
  error?: string;
}

export interface TestProviderResponse {
  success: boolean;
  errorCode?: 'no-key' | 'no-model';
  error?: string;
}

export interface CacheListResponse {
  entries: import('./cache-schema').CacheSummary[];
}
