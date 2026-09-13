import { SYNTH_MAX_ATTEMPTS } from '../lib/constants';
import { createLogger } from '../lib/logger';
import type {
  SynthesizeParams,
  SynthesizeResponse,
  VoicevoxConfig,
  VoicevoxSpeakersResponse,
} from '../lib/types';
import type { AudioQuery } from '../lib/voicevox';
import { flattenSpeakers, mergeQueries, splitSentences } from '../lib/voicevox';
import { arrayBufferToBase64 } from '../utils/audio-codec';

// VOICEVOX Engine の REST API で WAV を合成する。
// テキストを文単位に分けて audio_query を並列に引き、1 本のクエリへ統合してから synthesis に渡す。

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

  const sentences = splitSentences(params.text);
  if (sentences.length === 0) throw new Error('no text to synthesize');
  const queries = await Promise.all(
    sentences.map((sentence) => audioQuery(base, speaker, sentence)),
  );

  const synthRes = await fetch(`${base}/synthesis?speaker=${speaker}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(mergeQueries(queries, config)),
  });
  if (!synthRes.ok) throw new Error(`synthesis failed: HTTP ${synthRes.status}`);
  return synthRes.arrayBuffer();
}

async function audioQuery(base: string, speaker: string, text: string): Promise<AudioQuery> {
  const res = await fetch(
    `${base}/audio_query?text=${encodeURIComponent(text)}&speaker=${speaker}`,
    { method: 'POST' },
  );
  if (!res.ok) throw new Error(`audio_query failed: HTTP ${res.status}`);
  return (await res.json()) as AudioQuery;
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
