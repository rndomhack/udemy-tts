import { describe, expect, it } from 'vitest';
import {
  activeSegmentIndex,
  fontSizeToPx,
  overlayStyleToCss,
  pxToRatio,
  ratioToPx,
  SUBTITLE_FONT_BASE_HEIGHT,
  subtitleTextAt,
} from './subtitle';
import type { VttSegment } from './types';

const segs: VttSegment[] = [
  { startTime: 0, endTime: 2, text: 'a' },
  { startTime: 2, endTime: 4, text: 'b' },
  { startTime: 6, endTime: 8, text: 'c' },
];

describe('activeSegmentIndex', () => {
  it('returns -1 when empty or before the first segment', () => {
    expect(activeSegmentIndex([], 1)).toBe(-1);
    expect(activeSegmentIndex(segs, -1)).toBe(-1);
  });

  it('picks the last segment whose startTime <= t', () => {
    expect(activeSegmentIndex(segs, 0)).toBe(0);
    expect(activeSegmentIndex(segs, 1)).toBe(0);
    expect(activeSegmentIndex(segs, 2)).toBe(1);
    expect(activeSegmentIndex(segs, 5)).toBe(1);
    expect(activeSegmentIndex(segs, 100)).toBe(2);
  });
});

describe('subtitleTextAt', () => {
  const translations = { 0: ' hello ', 1: 'world', 2: '   ' };

  it('returns null when no segment is active', () => {
    expect(subtitleTextAt({ segments: segs, translations }, -1)).toBeNull();
  });

  it('returns null past the segment endTime (silent gap / tail)', () => {
    expect(subtitleTextAt({ segments: segs, translations }, 5)).toBeNull();
  });

  it('returns null when the translation is missing (no source fallback)', () => {
    expect(subtitleTextAt({ segments: segs, translations: {} }, 1)).toBeNull();
  });

  it('returns null when the text is blank', () => {
    expect(subtitleTextAt({ segments: segs, translations }, 6.5)).toBeNull();
  });

  it('trims and returns the active translation', () => {
    expect(subtitleTextAt({ segments: segs, translations }, 0.5)).toBe('hello');
    expect(subtitleTextAt({ segments: segs, translations }, 3)).toBe('world');
  });
});

describe('overlayStyleToCss', () => {
  it('maps color and background (not font-size)', () => {
    expect(
      overlayStyleToCss({ fontSize: 24, textColor: '#fff', backgroundColor: 'rgba(0,0,0,0.5)' }),
    ).toEqual({ color: '#fff', background: 'rgba(0,0,0,0.5)' });
  });
});

describe('fontSizeToPx', () => {
  it('returns the given size at the base height', () => {
    expect(fontSizeToPx(24, SUBTITLE_FONT_BASE_HEIGHT)).toBe(24);
  });

  it('scales proportionally with container height', () => {
    expect(fontSizeToPx(24, SUBTITLE_FONT_BASE_HEIGHT * 2)).toBe(48);
  });

  it('falls back to the base height when container height is unknown', () => {
    expect(fontSizeToPx(24, 0)).toBe(24);
  });

  it('never goes below 8px', () => {
    expect(fontSizeToPx(1, 100)).toBe(8);
  });
});

describe('pxToRatio / ratioToPx', () => {
  it('round-trips', () => {
    const r = pxToRatio(320, 180, 1280, 720);
    expect(r).toEqual({ xRatio: 0.25, yRatio: 0.25 });
    expect(ratioToPx(r, 1280, 720)).toEqual({ x: 320, y: 180 });
  });

  it('rescales a ratio to a different container size', () => {
    const r = pxToRatio(640, 360, 1280, 720);
    expect(ratioToPx(r, 1920, 1080)).toEqual({ x: 960, y: 540 });
  });
});
