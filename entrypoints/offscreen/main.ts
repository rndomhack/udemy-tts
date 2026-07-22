import { SYNTH_MAX_ATTEMPTS } from '../../src/lib/constants';
import { createLogger } from '../../src/lib/logger';
import { formatPitch, formatRate, formatVolume } from '../../src/lib/tts-format';
import type {
  DeviceTranslateParams,
  DeviceTranslateResponse,
  ExtensionMessage,
  SynthesizeParams,
  SynthesizeResponse,
} from '../../src/lib/types';
import { blobToBase64 } from '../../src/utils/audio-codec';
import { fetchVoices } from '../../src/utils/edge-voices';
import { registerMessageRouter } from '../../src/utils/messaging';

// Chrome の offscreen document。文書コンテキストが必要な音声合成・音声一覧取得・ブラウザ翻訳をここで実行する。
// バックグラウンドから張った WebSocket にはヘッダー書き換えが効かないため、Edge TTS への接続もここから張る。

const log = createLogger('offscreen');

registerMessageRouter(
  (msg: ExtensionMessage) => {
    switch (msg?.type) {
      case 'OFFSCREEN_SYNTHESIZE':
        return () => synthesize(msg);
      case 'OFFSCREEN_GET_VOICES':
        return () => fetchVoices();
      case 'OFFSCREEN_TRANSLATE':
        return () => translate(msg);
      default:
        return undefined;
    }
  },
  (e, msg) => {
    log.error(`handler failed for ${msg?.type}:`, e);
    return { success: false, error: e instanceof Error ? e.message : String(e) };
  },
);

async function synthesize(params: SynthesizeParams): Promise<SynthesizeResponse> {
  let lastError: unknown;
  for (let attempt = 1; attempt <= SYNTH_MAX_ATTEMPTS; attempt++) {
    try {
      const { EdgeTTS } = await import('edge-tts-universal/browser');
      const tts = new EdgeTTS(params.text, params.voice, {
        rate: formatRate(params.rate),
        pitch: formatPitch(params.pitch),
        volume: formatVolume(params.volume),
      });
      const result = await tts.synthesize();
      const audio = await blobToBase64(result.audio);
      return { success: true, audio };
    } catch (e) {
      lastError = e;
      console.warn(`[UdemyTTS:offscreen] synthesize attempt ${attempt}/${SYNTH_MAX_ATTEMPTS} failed:`, e);
    }
  }
  return { success: false, error: String(lastError) };
}

interface TranslatorSession {
  translate(text: string): Promise<string>;
}

interface TranslatorStatic {
  availability(opts: {
    sourceLanguage: string;
    targetLanguage: string;
  }): Promise<'unavailable' | 'downloadable' | 'downloading' | 'available'>;
  create(opts: { sourceLanguage: string; targetLanguage: string }): Promise<TranslatorSession>;
}

const sessionCache = new Map<string, Promise<TranslatorSession>>();

// ブラウザ翻訳は BCP 47 の言語コードを使うため、内部コードのうち zh-TW だけ寄せる
function toBcp47(code: string): string {
  return code === 'zh-TW' ? 'zh-Hant' : code;
}

async function translate(params: DeviceTranslateParams): Promise<DeviceTranslateResponse> {
  const api = (self as unknown as { Translator?: TranslatorStatic }).Translator;
  if (!api) return { success: false, error: 'Translator API is not available in this browser' };

  const sourceLanguage = toBcp47(params.sourceLang);
  const targetLanguage = toBcp47(params.targetLang);
  const key = `${sourceLanguage}:${targetLanguage}`;
  try {
    let sessionPromise = sessionCache.get(key);
    if (!sessionPromise) {
      const availability = await api.availability({ sourceLanguage, targetLanguage });
      if (availability === 'unavailable') {
        return { success: false, error: `unsupported pair ${sourceLanguage}→${targetLanguage}` };
      }
      sessionPromise = api.create({ sourceLanguage, targetLanguage });
      sessionCache.set(key, sessionPromise);
    }
    const session = await sessionPromise;
    const translations: string[] = [];
    for (const text of params.texts) translations.push(await session.translate(text));
    return { success: true, translations };
  } catch (e) {
    sessionCache.delete(key);
    return { success: false, error: String(e) };
  }
}
