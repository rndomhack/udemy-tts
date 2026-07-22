import type { ProviderId } from '../../types';
import type { LlmProvider, LlmRequest } from './types';
import { deepMerge, postJson, ProviderError } from './types';

// OpenAI 互換の chat/completions を呼ぶ翻訳クライアント (OpenAI・OpenRouter・カスタム互換で共用)

export interface ChatCompletionsOptions {
  id: ProviderId;
  apiKey: string;
  model: string;
  baseUrl: string;
  tokenParam: 'max_completion_tokens' | 'max_tokens';
  useJsonSchema: boolean;
  reasoningEffort?: string;
  reasoning?: Record<string, unknown>;
  extraBody?: Record<string, unknown>;
  systemSuffix?: string;
}

export function createChatCompletionsProvider(opts: ChatCompletionsOptions): LlmProvider {
  const base = opts.baseUrl.replace(/\/$/, '');
  return {
    id: opts.id,
    model: opts.model,
    async complete(req: LlmRequest): Promise<string> {
      const system = opts.systemSuffix ? `${req.system}\n\n${opts.systemSuffix}` : req.system;
      let body: Record<string, unknown> = {
        model: opts.model,
        messages: [
          { role: 'system', content: system },
          { role: 'user', content: req.user },
        ],
        [opts.tokenParam]: req.maxOutputTokens,
      };
      if (opts.useJsonSchema) {
        body.response_format = {
          type: 'json_schema',
          json_schema: { name: 'translation', strict: true, schema: req.schema },
        };
      }
      if (opts.reasoningEffort !== undefined) body.reasoning_effort = opts.reasoningEffort;
      if (opts.reasoning !== undefined) body.reasoning = opts.reasoning;
      if (opts.extraBody) body = deepMerge(body, opts.extraBody);

      const data = (await postJson(
        `${base}/chat/completions`,
        { authorization: `Bearer ${opts.apiKey}` },
        body,
      )) as { choices?: Array<{ message?: { content?: string } }> };
      const text = data.choices?.[0]?.message?.content;
      if (!text) throw new ProviderError(`${opts.id} returned empty response`);
      return text;
    },
  };
}
