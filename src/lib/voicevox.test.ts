import { describe, expect, it } from 'vitest';
import { flattenSpeakers } from './voicevox';

describe('flattenSpeakers', () => {
  it('flattens speakers and styles into labeled entries', () => {
    const json = [
      {
        name: 'ずんだもん',
        styles: [
          { id: 3, name: 'ノーマル' },
          { id: 1, name: 'あまあま' },
        ],
      },
      { name: '四国めたん', styles: [{ id: 2, name: 'ノーマル' }] },
    ];
    expect(flattenSpeakers(json)).toEqual([
      { id: 3, name: 'ずんだもん (ノーマル)' },
      { id: 1, name: 'ずんだもん (あまあま)' },
      { id: 2, name: '四国めたん (ノーマル)' },
    ]);
  });

  it('ignores malformed input', () => {
    expect(flattenSpeakers(null)).toEqual([]);
    expect(flattenSpeakers({})).toEqual([]);
    expect(flattenSpeakers([{ name: 'x' }, { styles: [{ id: 1, name: 's' }] }])).toEqual([]);
  });
});
