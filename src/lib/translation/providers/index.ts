import { findModelReasoning } from '../../constants';
import { createLogger } from '../../logger';
import type { ProviderConfig, ProviderId } from '../../types';
import { NO_SCHEMA_OUTPUT_FORMAT } from '../prompt';
import { createGeminiProvider } from './gemini';
import { createChatCompletionsProvider } from './openai';
import type { LlmProvider } from './types';

export { deepMerge, ProviderError } from './types';
export type { LlmProvider, LlmRequest } from './types';

import { deepMerge } from './types';

const log = createLogger('providers');

// 設定で選ばれたプロバイダに応じた翻訳クライアントを生成する
export function createProvider(
  id: Exclude<ProviderId, 'device'>,
  config: ProviderConfig,
): LlmProvider {
  switch (id) {
    case 'gemini':
      return createGeminiProvider(
        config.apiKey,
        config.model,
        findModelReasoning('gemini', config.model),
      );
    case 'openai':
      return createChatCompletionsProvider({
        id,
        apiKey: config.apiKey,
        model: config.model,
        baseUrl: 'https://api.openai.com/v1',
        tokenParam: 'max_completion_tokens',
        useJsonSchema: true,
        reasoningEffort: findModelReasoning('openai', config.model),
      });
    case 'openrouter': {
      const reasoning = findModelReasoning('openrouter', config.model);
      return createChatCompletionsProvider({
        id,
        apiKey: config.apiKey,
        model: config.model,
        baseUrl: 'https://openrouter.ai/api/v1',
        tokenParam: 'max_tokens',
        useJsonSchema: true,
        reasoning:
          reasoning === 'none'
            ? { enabled: false }
            : reasoning !== undefined
              ? { effort: reasoning }
              : undefined,
        extraBody: buildOpenRouterExtraBody(config.sort, config.extraBody),
      });
    }
    case 'openai-compatible':
      return createChatCompletionsProvider({
        id,
        apiKey: config.apiKey,
        model: config.model,
        baseUrl: config.baseUrl || 'https://api.openai.com/v1',
        tokenParam: 'max_tokens',
        useJsonSchema: config.useJsonSchema ?? false,
        // 構造化出力を使わない場合だけ、出力形式の指示を system プロンプトの末尾に足す
        ...(config.useJsonSchema ? {} : { systemSuffix: NO_SCHEMA_OUTPUT_FORMAT }),
        extraBody: parseExtraBody(config.extraBody),
      });
  }
}

function buildOpenRouterExtraBody(
  sort: string | undefined,
  extraBody: string | undefined,
): Record<string, unknown> | undefined {
  const userExtra = parseExtraBody(extraBody);
  if (!sort?.trim()) return userExtra;
  const sortExtra: Record<string, unknown> = {
    provider: { sort: { by: sort, partition: null } },
  };
  return userExtra ? deepMerge(userExtra, sortExtra) : sortExtra;
}

function parseExtraBody(raw: string | undefined): Record<string, unknown> | undefined {
  if (!raw?.trim()) return undefined;
  try {
    const value = JSON.parse(raw) as unknown;
    if (value && typeof value === 'object' && !Array.isArray(value)) {
      return value as Record<string, unknown>;
    }
    log.warn('extraBody is not a JSON object, ignoring');
    return undefined;
  } catch (e) {
    log.warn('extraBody is invalid JSON, ignoring:', e);
    return undefined;
  }
}
