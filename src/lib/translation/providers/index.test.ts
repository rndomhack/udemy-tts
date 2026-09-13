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

  it('openai-compatible with responseFormat "jsonSchema": sends json_schema and no suffix', async () => {
    const fn = mockFetch(chatOk);
    await createProvider('openai-compatible', {
      apiKey: 'k',
      model: 'x',
      baseUrl: 'https://api.groq.com/openai/v1',
      responseFormat: 'jsonSchema',
    }).complete(req);
    const body = sentBody(fn);
    expect((body.response_format as { type: string }).type).toBe('json_schema');
    const system = (body.messages as Array<{ role: string; content: string }>)[0].content;
    expect(system).toBe('sys');
  });

  it('openrouter: qwen preset uses jsonObject response_format and the output-format suffix', async () => {
    const fn = mockFetch(chatOk);
    await createProvider('openrouter', {
      apiKey: 'k',
      model: 'qwen/qwen3.6-flash',
    }).complete(req);
    const body = sentBody(fn);
    expect(body.response_format).toEqual({ type: 'json_object' });
    const system = (body.messages as Array<{ role: string; content: string }>)[0].content;
    expect(system).toContain('Respond with only this JSON');
  });

  it('openrouter: deepseek preset uses strict json_schema and no suffix', async () => {
    const fn = mockFetch(chatOk);
    await createProvider('openrouter', {
      apiKey: 'k',
      model: 'deepseek/deepseek-v4-flash',
    }).complete(req);
    const body = sentBody(fn);
    expect((body.response_format as { type: string }).type).toBe('json_schema');
    const system = (body.messages as Array<{ role: string; content: string }>)[0].content;
    expect(system).toBe('sys');
  });

  it('openrouter: preset id is sent as the mapped API model name', async () => {
    const fn = mockFetch(chatOk);
    await createProvider('openrouter', {
      apiKey: 'k',
      model: 'deepseek/deepseek-v4-flash',
    }).complete(req);
    expect(sentBody(fn).model).toBe('deepseek/deepseek-v4-flash-0731');
  });

  it('openrouter: a preset without a model mapping is sent by its id', async () => {
    const fn = mockFetch(chatOk);
    await createProvider('openrouter', { apiKey: 'k', model: 'qwen/qwen3.8-flash' }).complete(req);
    const body = sentBody(fn);
    expect(body.model).toBe('qwen/qwen3.8-flash');
    expect((body.response_format as { type: string }).type).toBe('json_schema');
  });

  it('openrouter: glm preset sends a reasoning effort instead of disabling it', async () => {
    const fn = mockFetch(chatOk);
    await createProvider('openrouter', { apiKey: 'k', model: 'z-ai/glm-5.3-flash' }).complete(req);
    const body = sentBody(fn);
    expect(body.reasoning).toEqual({ effort: 'low' });
    expect(body.response_format).toEqual({ type: 'json_object' });
  });

  it('openrouter: unlisted model is sent as-is and defaults to "none" (no response_format, gets the suffix)', async () => {
    const fn = mockFetch(chatOk);
    await createProvider('openrouter', {
      apiKey: 'k',
      model: 'some/unknown-model',
    }).complete(req);
    const body = sentBody(fn);
    expect(body.model).toBe('some/unknown-model');
    expect(body.response_format).toBeUndefined();
    const system = (body.messages as Array<{ role: string; content: string }>)[0].content;
    expect(system).toContain('Respond with only this JSON');
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
