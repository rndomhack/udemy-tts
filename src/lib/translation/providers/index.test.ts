import { afterEach, describe, expect, it, vi } from 'vitest';
import { createProvider } from './index';

const req = { system: 'sys', user: 'usr', schema: { type: 'object' }, maxOutputTokens: 100 };

function mockFetch(json: unknown) {
  const fn = vi.fn((_url: string, _init: { body: string }) =>
    Promise.resolve({ ok: true, status: 200, json: async () => json }),
  );
  vi.stubGlobal('fetch', fn);
  return fn;
}

function sentBody(fn: ReturnType<typeof mockFetch>): Record<string, unknown> {
  return JSON.parse(fn.mock.calls[0][1].body);
}

const chatOk = { choices: [{ message: { content: '{}' } }] };
const geminiOk = { candidates: [{ content: { parts: [{ text: '{}' }] } }] };

afterEach(() => vi.unstubAllGlobals());

describe('createProvider request bodies', () => {
  it('openai: max_completion_tokens + json_schema + reasoning_effort from preset', async () => {
    const fn = mockFetch(chatOk);
    await createProvider('openai', { apiKey: 'k', model: 'gpt-5.4-mini' }).complete(req);
    const body = sentBody(fn);
    expect(body.max_completion_tokens).toBe(100);
    expect((body.response_format as { type: string }).type).toBe('json_schema');
    expect(body.reasoning_effort).toBe('low');
  });

  it('openrouter: "none" reasoning becomes {enabled:false} and dropdown sort composes provider.sort', async () => {
    const fn = mockFetch(chatOk);
    await createProvider('openrouter', {
      apiKey: 'k',
      model: 'deepseek/deepseek-v4-flash',
      sort: 'throughput',
    }).complete(req);
    const body = sentBody(fn);
    expect(body.max_tokens).toBe(100);
    expect(body.reasoning).toEqual({ enabled: false });
    expect((body.provider as { sort: unknown }).sort).toEqual({ by: 'throughput', partition: null });
  });

  it('openrouter: user extraBody deep-merges into the request', async () => {
    const fn = mockFetch(chatOk);
    await createProvider('openrouter', {
      apiKey: 'k',
      model: 'deepseek/deepseek-v4-flash',
      extraBody: '{"temperature":0.9}',
    }).complete(req);
    expect(sentBody(fn).temperature).toBe(0.9);
  });

  it('openai-compatible: no json_schema, custom baseUrl, and output-format suffix on system', async () => {
    const fn = mockFetch(chatOk);
    await createProvider('openai-compatible', {
      apiKey: 'k',
      model: 'x',
      baseUrl: 'https://api.groq.com/openai/v1',
    }).complete(req);
    expect(fn.mock.calls[0][0]).toBe('https://api.groq.com/openai/v1/chat/completions');
    const body = sentBody(fn);
    expect(body.response_format).toBeUndefined();
    expect(body.max_tokens).toBe(100);
    const system = (body.messages as Array<{ role: string; content: string }>)[0].content;
    expect(system.startsWith('sys')).toBe(true);
    expect(system).toContain('Respond with only this JSON');
  });

  it('openai-compatible with useJsonSchema: sends json_schema and no suffix', async () => {
    const fn = mockFetch(chatOk);
    await createProvider('openai-compatible', {
      apiKey: 'k',
      model: 'x',
      baseUrl: 'https://api.groq.com/openai/v1',
      useJsonSchema: true,
    }).complete(req);
    const body = sentBody(fn);
    expect((body.response_format as { type: string }).type).toBe('json_schema');
    const system = (body.messages as Array<{ role: string; content: string }>)[0].content;
    expect(system).toBe('sys');
  });

  it('schema providers do not get the output-format suffix', async () => {
    const fn = mockFetch(chatOk);
    await createProvider('openai', { apiKey: 'k', model: 'gpt-5.4-mini' }).complete(req);
    const system = (sentBody(fn).messages as Array<{ role: string; content: string }>)[0].content;
    expect(system).toBe('sys');
  });

  it('gemini: sends responseJsonSchema and thinkingConfig from preset', async () => {
    const fn = mockFetch(geminiOk);
    await createProvider('gemini', { apiKey: 'k', model: 'gemini-3.1-flash-lite' }).complete(req);
    const cfg = sentBody(fn).generationConfig as Record<string, unknown>;
    expect(cfg.responseJsonSchema).toBeDefined();
    expect((cfg.thinkingConfig as { thinkingLevel: string }).thinkingLevel).toBe('minimal');
  });
});
