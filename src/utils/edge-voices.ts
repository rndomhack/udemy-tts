import { createLogger } from '../lib/logger';
import type { GetVoicesResponse } from '../lib/types';

// Edge TTS が提供する音声の一覧を取得する

const log = createLogger('voices');

export async function fetchVoices(): Promise<GetVoicesResponse> {
  try {
    const { listVoices } = await import('edge-tts-universal/webworker');
    const voices = (await listVoices()) as Array<{
      ShortName: string;
      Locale: string;
      Gender: string;
    }>;
    log.debug(`voices loaded: ${voices.length}`);
    return {
      voices: voices.map((v) => ({
        shortName: v.ShortName,
        locale: v.Locale,
        gender: v.Gender,
      })),
    };
  } catch (e) {
    log.warn('listVoices failed:', e);
    return { voices: [] };
  }
}
