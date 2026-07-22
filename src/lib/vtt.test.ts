import { describe, expect, it } from 'vitest';
import { mergeCuesIntoSegments, parseVtt } from './vtt';

const SAMPLE_VTT = `WEBVTT

1
00:00:01.000 --> 00:00:03.500
Hello everyone and welcome

2
00:00:03.500 --> 00:00:05.000
to this course.

3
00:01:00.000 --> 00:01:02.000
Instructor: Let's get started!
`;

describe('parseVtt', () => {
  it('parses cues with mm:ss and hh:mm:ss times', () => {
    const cues = parseVtt(SAMPLE_VTT);
    expect(cues).toHaveLength(3);
    expect(cues[0].startTime).toBeCloseTo(1.0);
    expect(cues[0].endTime).toBeCloseTo(3.5);
    expect(cues[0].text).toBe('Hello everyone and welcome');
  });

  it('parses mm:ss format (no hours)', () => {
    const cues = parseVtt('00:05.000 --> 00:07.250\nShort format\n');
    expect(cues[0].startTime).toBeCloseTo(5.0);
    expect(cues[0].endTime).toBeCloseTo(7.25);
  });

  it('strips speaker labels', () => {
    const cues = parseVtt(SAMPLE_VTT);
    expect(cues[2].text).toBe("Let's get started!");
  });

  it('strips <v Name> speaker tags', () => {
    const cues = parseVtt('00:00:01.000 --> 00:00:02.000\n<v Maximilian>Hello there</v>\n');
    expect(cues[0].text).toBe('Hello there');
  });

  it('does not strip comparison operators that look like tags', () => {
    const cues = parseVtt('00:00:01.000 --> 00:00:02.000\nif x < 5 and y > 3, do this\n');
    expect(cues[0].text).toBe('if x < 5 and y > 3, do this');
  });

  it('joins multi-line cue text with spaces', () => {
    const cues = parseVtt('00:00:01.000 --> 00:00:02.000\nline one\nline two\n');
    expect(cues[0].text).toBe('line one line two');
  });

  it('skips cues with empty text', () => {
    const cues = parseVtt('00:00:01.000 --> 00:00:02.000\n\n00:00:03.000 --> 00:00:04.000\nreal\n');
    expect(cues).toHaveLength(1);
    expect(cues[0].text).toBe('real');
  });
});

describe('mergeCuesIntoSegments', () => {
  it('merges cues until sentence-ending punctuation', () => {
    const segments = mergeCuesIntoSegments(parseVtt(SAMPLE_VTT));
    expect(segments).toHaveLength(2);
    expect(segments[0]).toEqual({
      startTime: 1.0,
      endTime: 5.0,
      text: 'Hello everyone and welcome to this course.',
    });
    expect(segments[1].text).toBe("Let's get started!");
  });

  it('handles CJK sentence enders', () => {
    const segments = mergeCuesIntoSegments([
      { startTime: 0, endTime: 1, text: 'こんにちは。' },
      { startTime: 1, endTime: 2, text: '始めましょう！' },
    ]);
    expect(segments).toHaveLength(2);
  });

  it('handles the Arabic question mark (U+061F) as a sentence ender', () => {
    const segments = mergeCuesIntoSegments([
      { startTime: 0, endTime: 1, text: 'كيف حالك؟' },
      { startTime: 1, endTime: 2, text: 'مرحبا.' },
    ]);
    expect(segments).toHaveLength(2);
  });

  it('caps merged cues at MERGE_MAX_CUES for punctuation-less languages', () => {
    const cues = Array.from({ length: 25 }, (_, i) => ({
      startTime: i,
      endTime: i + 1,
      text: `ก${i}`,
    }));
    const segments = mergeCuesIntoSegments(cues);
    expect(segments).toHaveLength(3);
    expect(segments[0].text.split(' ')).toHaveLength(10);
    expect(segments[1].text.split(' ')).toHaveLength(10);
    expect(segments[2].text.split(' ')).toHaveLength(5);
  });

  it('does not cap when sentences end naturally within the limit', () => {
    const cues = Array.from({ length: 12 }, (_, i) => ({
      startTime: i,
      endTime: i + 1,
      text: `Sentence ${i}.`,
    }));
    expect(mergeCuesIntoSegments(cues)).toHaveLength(12);
  });

  it('flushes trailing buffer without sentence ender', () => {
    const segments = mergeCuesIntoSegments([
      { startTime: 5, endTime: 6, text: 'no punctuation here' },
    ]);
    expect(segments).toEqual([{ startTime: 5, endTime: 6, text: 'no punctuation here' }]);
  });
});
