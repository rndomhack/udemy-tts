import { describe, expect, it } from 'vitest';
import { originPattern } from './host-pattern';

describe('originPattern', () => {
  it('drops the port from the pattern', () => {
    expect(originPattern('http://127.0.0.1:50021')).toBe('http://127.0.0.1/*');
    expect(originPattern('https://api.example.com:8443/v1')).toBe('https://api.example.com/*');
  });

  it('keeps portless origins as-is', () => {
    expect(originPattern('https://api.example.com/v1/chat')).toBe('https://api.example.com/*');
  });

  it('trims surrounding whitespace', () => {
    expect(originPattern('  http://localhost:50021  ')).toBe('http://localhost/*');
  });

  it('returns null for invalid or non-http URLs', () => {
    expect(originPattern('')).toBeNull();
    expect(originPattern('not a url')).toBeNull();
    expect(originPattern('file:///tmp/x')).toBeNull();
  });
});
