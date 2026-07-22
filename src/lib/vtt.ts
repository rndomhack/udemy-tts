import { MERGE_MAX_CUES } from './constants';
import type { VttCue, VttSegment } from './types';

// 字幕 VTT を解析し、文単位のセグメントへ統合する

function parseVttTime(str: string): number {
  const parts = str.trim().split(':');
  if (parts.length === 2) return parseFloat(parts[0]) * 60 + parseFloat(parts[1]);
  return parseFloat(parts[0]) * 3600 + parseFloat(parts[1]) * 60 + parseFloat(parts[2]);
}

export function parseVtt(vttText: string): VttCue[] {
  const cues: VttCue[] = [];
  const lines = vttText.split(/\r?\n/);
  let i = 0;
  while (i < lines.length) {
    if (!lines[i].includes('-->')) {
      i++;
      continue;
    }
    const [startStr, rest] = lines[i].split('-->');
    const endStr = rest.split(' ')[1] ?? rest;
    const startTime = parseVttTime(startStr);
    const endTime = parseVttTime(endStr);
    i++;
    const textLines: string[] = [];
    while (i < lines.length && lines[i].trim() !== '') {
      textLines.push(lines[i].trim());
      i++;
    }
    // ラベル (例 "SPEAKER: " / `<v Name>` タグ) を除去する。
    const text = textLines
      .join(' ')
      .replace(/<\/?(?:v|c|b|i|u|lang|ruby|rt)(?:[.\s][^>]*)?>/gi, '')
      .replace(/^[A-Za-z\s]+:\s*/, '')
      .trim();
    if (text) cues.push({ startTime, endTime, text });
  }
  return cues;
}

// 各言語の文末記号
const SENTENCE_END = /[.!?。｡！？؟]\s*$/;

/** 文末記号が現れるまで字幕の区間をつなげ、1 文を 1 セグメントにする */
export function mergeCuesIntoSegments(cues: VttCue[]): VttSegment[] {
  const segments: VttSegment[] = [];
  let buffer = '';
  let startTime: number | null = null;
  let endTime = 0;
  let cueCount = 0;
  for (const cue of cues) {
    if (startTime === null) startTime = cue.startTime;
    endTime = cue.endTime;
    buffer = buffer ? `${buffer} ${cue.text}` : cue.text;
    cueCount++;
    // 文末記号を使わない言語で 1 セグメントが際限なく膨らむのを防ぐため、つなげる区間数で頭打ちする
    if (SENTENCE_END.test(buffer) || cueCount >= MERGE_MAX_CUES) {
      segments.push({ startTime, endTime, text: buffer.trim() });
      buffer = '';
      startTime = null;
      cueCount = 0;
    }
  }
  if (buffer.trim()) segments.push({ startTime: startTime ?? 0, endTime, text: buffer.trim() });
  return segments;
}
