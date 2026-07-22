import { describe, expect, it } from 'vitest';
import { mergeSettings } from './storage';

describe('mergeSettings', () => {
  it('fills every field from defaults for null/empty input', () => {
    const merged = mergeSettings(null);
    expect(merged.activeProvider).toBeDefined();
    expect(Object.keys(merged.providers).sort()).toEqual([
      'device',
      'gemini',
      'openai',
      'openai-compatible',
      'openrouter',
    ]);
    expect(merged.subtitleStyle.fontSize).toBeGreaterThan(0);
  });

  it('deep-merges a partial provider config (keeps model, other providers)', () => {
    const merged = mergeSettings({ providers: { gemini: { apiKey: 'k' } } } as never);
    expect(merged.providers.gemini.apiKey).toBe('k');
    expect(merged.providers.gemini.model).toBeTruthy();
    expect(merged.providers.openai).toBeDefined();
  });

  it('deep-merges subtitleStyle without dropping unspecified fields', () => {
    const merged = mergeSettings({ subtitleStyle: { fontSize: 40 } } as never);
    expect(merged.subtitleStyle.fontSize).toBe(40);
    expect(merged.subtitleStyle.textColor).toBeTruthy();
    expect(merged.subtitleStyle.backgroundColor).toBeTruthy();
  });

  it('preserves valid stored scalar values', () => {
    const merged = mergeSettings({ ttsRate: 1.5, targetLanguage: 'ja' } as never);
    expect(merged.ttsRate).toBe(1.5);
    expect(merged.targetLanguage).toBe('ja');
  });
});
