import type { LlmProvider, LlmRequest } from './types';
import { postJson, ProviderError } from './types';

// Gemini の generateContent を呼ぶ翻訳クライアント

export function createGeminiProvider(
  apiKey: string,
  model: string,
  thinkingLevel?: string,
): LlmProvider {
  return {
    id: 'gemini',
    model,
    async complete(req: LlmRequest): Promise<string> {
      const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`;
      const data = (await postJson(
        url,
        { 'x-goog-api-key': apiKey },
        {
          system_instruction: { parts: [{ text: req.system }] },
          contents: [{ role: 'user', parts: [{ text: req.user }] }],
          generationConfig: {
            temperature: 0.2,
            maxOutputTokens: req.maxOutputTokens,
            responseMimeType: 'application/json',
            responseJsonSchema: req.schema,
            ...(thinkingLevel !== undefined && {
              thinkingConfig: { thinkingLevel },
            }),
          },
        },
      )) as {
        candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>;
      };
      const text = (data.candidates?.[0]?.content?.parts ?? [])
        .map((p) => p.text ?? '')
        .join('');
      if (!text) throw new ProviderError('Gemini returned empty response');
      return text;
    },
  };
}
