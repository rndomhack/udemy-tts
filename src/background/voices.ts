import { browser } from '#imports';
import { createLogger } from '../lib/logger';
import type { GetVoicesResponse } from '../lib/types';
import { fetchVoices } from '../utils/edge-voices';
import { ensureOffscreenDocument } from './synth';

// 利用できる音声の一覧を取得する。
// Firefox は直接、Chrome は動的 import が使えないため offscreen 経由で取る。

const log = createLogger('voices');

export async function handleGetVoices(): Promise<GetVoicesResponse> {
  if (import.meta.env.FIREFOX) {
    return fetchVoices();
  }
  try {
    await ensureOffscreenDocument();
    const response = (await browser.runtime.sendMessage({
      type: 'OFFSCREEN_GET_VOICES',
    })) as GetVoicesResponse | undefined;
    return response ?? { voices: [] };
  } catch (e) {
    log.warn('getVoices via offscreen failed:', e);
    return { voices: [] };
  }
}
