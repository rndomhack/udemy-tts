import { browser } from '#imports';
import { SYNTH_MAX_ATTEMPTS } from '../lib/constants';
import { createLogger } from '../lib/logger';
import { formatPitch, formatRate, formatVolume } from '../lib/tts-format';
import type { SynthesizeParams, SynthesizeResponse } from '../lib/types';
import { getSettings } from '../utils/storage';
import { synthesizeVoicevox } from './voicevox';

// テキストを設定で選んだ音声プロバイダで合成する。
// Edge TTS は Firefox で直接・Chrome で offscreen document へ委譲し、VOICEVOX は fetch で完結する。

const log = createLogger('synth');

export async function handleSynthesize(params: SynthesizeParams): Promise<SynthesizeResponse> {
  const settings = await getSettings();
  if (settings.ttsProvider === 'voicevox') {
    return synthesizeVoicevox(params, settings.voicevox);
  }
  if (import.meta.env.FIREFOX) {
    return synthesizeDirect(params);
  }
  return delegateToOffscreen(params);
}

async function synthesizeDirect(params: SynthesizeParams): Promise<SynthesizeResponse> {
  let lastError: unknown;
  for (let attempt = 1; attempt <= SYNTH_MAX_ATTEMPTS; attempt++) {
    try {
      const { EdgeTTS } = await import('edge-tts-universal/webworker');
      const tts = new EdgeTTS(params.text, params.voice, {
        rate: formatRate(params.rate),
        pitch: formatPitch(params.pitch),
        volume: formatVolume(params.volume),
      });
      const result = await tts.synthesize();
      const audio = await result.audio.arrayBuffer();
      log.debug(`synthesize ok (attempt ${attempt}): ${audio.byteLength}B`);
      return { success: true, audio };
    } catch (e) {
      lastError = e;
      log.warn(`synthesize attempt ${attempt}/${SYNTH_MAX_ATTEMPTS} failed:`, e);
    }
  }
  return { success: false, error: String(lastError) };
}

let offscreenCreating: Promise<void> | null = null;

export async function ensureOffscreenDocument(): Promise<void> {
  if (await browser.offscreen.hasDocument()) return;
  // 同時に呼ばれても document を二重生成しないよう、生成中の Promise を共有する
  if (!offscreenCreating) {
    offscreenCreating = browser.offscreen
      .createDocument({
        url: 'offscreen.html',
        reasons: ['BLOBS'],
        justification:
          'Edge TTS WebSocket must be opened from a document context so that ' +
          'declarativeNetRequest header rewriting applies (crbug.com/1285664)',
      })
      .catch((e: unknown) => {
        if (!String(e).includes('single offscreen document')) throw e;
      })
      .finally(() => {
        offscreenCreating = null;
      });
  }
  await offscreenCreating;
}

async function delegateToOffscreen(params: SynthesizeParams): Promise<SynthesizeResponse> {
  await ensureOffscreenDocument();
  const response = (await browser.runtime.sendMessage({
    ...params,
    type: 'OFFSCREEN_SYNTHESIZE',
  })) as SynthesizeResponse | undefined;
  return response ?? { success: false, error: 'No response from offscreen document' };
}
