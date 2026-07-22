import type { VoicevoxSpeaker } from './types';

// VOICEVOX Engine の /speakers 応答を、スタイル単位の選択肢へ平坦化する

interface RawSpeaker {
  name?: string;
  styles?: Array<{ id?: number; name?: string }>;
}

export function flattenSpeakers(json: unknown): VoicevoxSpeaker[] {
  if (!Array.isArray(json)) return [];
  const result: VoicevoxSpeaker[] = [];
  for (const speaker of json as RawSpeaker[]) {
    if (!speaker?.name || !Array.isArray(speaker.styles)) continue;
    for (const style of speaker.styles) {
      if (typeof style?.id !== 'number' || !style.name) continue;
      result.push({ id: style.id, name: `${speaker.name} (${style.name})` });
    }
  }
  return result;
}
