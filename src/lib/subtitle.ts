import type { SubtitleStyle, VttSegment } from './types';

// 再生位置から、表示すべき字幕テキストと表示位置を求める

export interface SubtitleState {
  segments: VttSegment[];
  translations: Record<number, string>;
}

export function activeSegmentIndex(segments: VttSegment[], t: number): number {
  let idx = -1;
  for (let i = 0; i < segments.length; i++) {
    if (segments[i].startTime <= t) idx = i;
    else break;
  }
  return idx;
}

/** 現在位置の訳を返す。区間外・未翻訳・空文字のときは表示しない (null) */
export function subtitleTextAt(state: SubtitleState, t: number): string | null {
  const idx = activeSegmentIndex(state.segments, t);
  if (idx < 0) return null;
  if (t >= state.segments[idx].endTime) return null;
  const raw = state.translations[idx];
  if (raw === undefined) return null;
  const text = raw.trim();
  return text === '' ? null : text;
}

export function overlayStyleToCss(style: SubtitleStyle): Record<string, string> {
  return {
    color: style.textColor,
    background: style.backgroundColor,
  };
}

export const SUBTITLE_FONT_BASE_HEIGHT = 720;
export function fontSizeToPx(fontSize: number, containerHeight: number): number {
  const h = containerHeight > 0 ? containerHeight : SUBTITLE_FONT_BASE_HEIGHT;
  return Math.max(8, (fontSize * h) / SUBTITLE_FONT_BASE_HEIGHT);
}

export interface Ratio {
  xRatio: number;
  yRatio: number;
}

export function pxToRatio(x: number, y: number, w: number, h: number): Ratio {
  return { xRatio: x / w, yRatio: y / h };
}

export function ratioToPx(r: Ratio, w: number, h: number): { x: number; y: number } {
  return { x: r.xRatio * w, y: r.yRatio * h };
}
