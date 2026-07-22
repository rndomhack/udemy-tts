import { describe, expect, it } from 'vitest';
import { deepMerge } from './types';

describe('deepMerge', () => {
  it('merges nested plain objects recursively', () => {
    const base = { a: 1, nested: { x: 1, y: 2 } };
    const extra = { nested: { y: 3, z: 4 }, b: 2 };
    expect(deepMerge(base, extra)).toEqual({ a: 1, b: 2, nested: { x: 1, y: 3, z: 4 } });
  });

  it('replaces arrays and primitives instead of merging', () => {
    const base = { list: [1, 2], value: 'a' };
    const extra = { list: [3], value: 'b' };
    expect(deepMerge(base, extra)).toEqual({ list: [3], value: 'b' });
  });

  it('does not mutate the inputs', () => {
    const base = { nested: { x: 1 } };
    const extra = { nested: { y: 2 } };
    deepMerge(base, extra);
    expect(base).toEqual({ nested: { x: 1 } });
    expect(extra).toEqual({ nested: { y: 2 } });
  });

  it('source null overrides object', () => {
    expect(deepMerge({ a: { x: 1 } }, { a: null })).toEqual({ a: null });
  });
});
