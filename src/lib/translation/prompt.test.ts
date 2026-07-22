import { describe, expect, it } from 'vitest';
import { buildSystemPrompt, buildUserPrompt } from './prompt';

describe('buildSystemPrompt', () => {
  it('includes source and target language names', () => {
    const prompt = buildSystemPrompt('English', 'Japanese', 'standard');
    expect(prompt).toContain('English→Japanese');
  });

  it('keeps the pronunciation_map anchor phrase', () => {
    expect(buildSystemPrompt('English', 'Japanese', 'standard')).toContain(
      'exactly as written in your translation',
    );
  });

  it('standard personality adds no style section', () => {
    expect(buildSystemPrompt('English', 'Japanese', 'standard')).not.toContain('Style (');
  });

  it('non-standard personality adds a style section', () => {
    expect(buildSystemPrompt('English', 'Japanese', 'concise')).toContain('Style (');
    expect(buildSystemPrompt('English', 'Japanese', 'friendly')).toContain('Style (');
  });

  it('custom personality injects the user instructions', () => {
    const prompt = buildSystemPrompt('English', 'Japanese', 'custom', '  Speak like a pirate.  ');
    expect(prompt).toContain('Style (');
    expect(prompt).toContain('Speak like a pirate.');
  });

  it('custom personality with empty instructions adds no style section', () => {
    expect(buildSystemPrompt('English', 'Japanese', 'custom', '   ')).not.toContain('Style (');
    expect(buildSystemPrompt('English', 'Japanese', 'custom')).not.toContain('Style (');
  });
});

describe('buildUserPrompt', () => {
  it('maps texts to absolute indices from offset', () => {
    const prompt = buildUserPrompt(['a', 'b'], 100);
    expect(JSON.parse(prompt)).toEqual({ '100': 'a', '101': 'b' });
  });
});
