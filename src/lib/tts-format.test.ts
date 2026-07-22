import { describe, expect, it } from 'vitest';
import { formatPitch, formatRate, formatVolume } from './tts-format';

describe('tts-format', () => {
  it('formats rate', () => {
    expect(formatRate(1.0)).toBe('+0%');
    expect(formatRate(1.2)).toBe('+20%');
    expect(formatRate(0.8)).toBe('-20%');
  });

  it('formats pitch', () => {
    expect(formatPitch(1.0)).toBe('+0Hz');
    expect(formatPitch(1.1)).toBe('+10Hz');
    expect(formatPitch(0.9)).toBe('-10Hz');
  });

  it('formats volume', () => {
    expect(formatVolume(1.0)).toBe('+0%');
    expect(formatVolume(0.5)).toBe('-50%');
  });
});
