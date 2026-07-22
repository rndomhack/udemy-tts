import { SYNTH_MAX_ATTEMPTS } from '../lib/constants';
import { createLogger } from '../lib/logger';
import type {
  SynthesizeParams,
  SynthesizeResponse,
  VoicevoxConfig,
  VoicevoxSpeakersResponse,
} from '../lib/types';
import { flattenSpeakers } from '../lib/voicevox';
import { arrayBufferToBase64 } from '../utils/audio-codec';

// VOICEVOX Engine の REST API で WAV を合成する。audio_query で合成パラメータを得て synthesis に渡す

const log = createLogger('voicevox');

export async function synthesizeVoicevox(
  params: SynthesizeParams,
  config: VoicevoxConfig,
): Promise<SynthesizeResponse> {
  let lastError: unknown;
  for (let attempt = 1; attempt <= SYNTH_MAX_ATTEMPTS; attempt++) {
    try {
      const audio = await synthesizeOnce(params, config);
      log.debug(`synthesize ok (attempt ${attempt}): ${audio.byteLength}B`);
      return {
        success: true,
        audio: import.meta.env.FIREFOX ? audio : arrayBufferToBase64(audio),
      };
    } catch (e) {
      lastError = e;
      log.warn(`synthesize attempt ${attempt}/${SYNTH_MAX_ATTEMPTS} failed:`, e);
    }
  }
  return { success: false, error: String(lastError) };
}

async function synthesizeOnce(
  params: SynthesizeParams,
  config: VoicevoxConfig,
): Promise<ArrayBuffer> {
  const base = config.baseUrl.trim().replace(/\/+$/, '');
  const speaker = encodeURIComponent(String(config.speaker));

  const queryRes = await fetch(
    `${base}/audio_query?text=${encodeURIComponent(params.text)}&speaker=${speaker}`,
    { method: 'POST' },
  );
  if (!queryRes.ok) throw new Error(`audio_query failed: HTTP ${queryRes.status}`);
  const query = (await queryRes.json()) as Record<string, unknown>;

  const synthRes = await fetch(`${base}/synthesis?speaker=${speaker}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(query),
  });
  if (!synthRes.ok) throw new Error(`synthesis failed: HTTP ${synthRes.status}`);
  return synthRes.arrayBuffer();
}

export async function handleVoicevoxSpeakers(
  config: VoicevoxConfig,
): Promise<VoicevoxSpeakersResponse> {
  try {
    const base = config.baseUrl.trim().replace(/\/+$/, '');
    const res = await fetch(`${base}/speakers`);
    if (!res.ok) throw new Error(`speakers failed: HTTP ${res.status}`);
    return { success: true, speakers: flattenSpeakers(await res.json()) };
  } catch (e) {
    log.warn('speakers fetch failed:', e);
    return { success: false, error: e instanceof Error ? e.message : String(e) };
  }
}
