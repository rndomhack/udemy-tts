import { describe, expect, it } from 'vitest';
import { WordSubstituter } from './words';

describe('WordSubstituter', () => {
  it('substitutes case-insensitively', () => {
    const sub = WordSubstituter.fromDict({ API: 'エーピーアイ' });
    expect(sub.substitute('The api is ready')).toBe('The エーピーアイ is ready');
  });

  it('prefers longer words first', () => {
    const sub = WordSubstituter.fromDict({ SQL: 'エスキューエル', PostgreSQL: 'ポスグレ' });
    expect(sub.substitute('PostgreSQL uses SQL')).toBe('ポスグレ uses エスキューエル');
  });

  it('escapes regex special characters', () => {
    const sub = WordSubstituter.fromDict({ 'C++': 'シープラプラ' });
    expect(sub.substitute('I love C++')).toBe('I love シープラプラ');
  });

  it('skips entries with empty readings', () => {
    const sub = WordSubstituter.fromDict({ foo: '' });
    expect(sub.substitute('foo bar')).toBe('foo bar');
  });

  it('merge combines both dictionaries', () => {
    const a = WordSubstituter.fromDict({ AWS: 'エーダブリューエス' });
    const b = WordSubstituter.fromDict({ GCP: 'ジーシーピー' });
    expect(a.merge(b).substitute('AWS and GCP')).toBe('エーダブリューエス and ジーシーピー');
  });
});
