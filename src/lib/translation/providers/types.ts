import type { ProviderId } from '../../types';

// プロバイダ共通の型と、HTTP リクエスト・JSON 処理の補助をまとめる

export interface LlmRequest {
  system: string;
  user: string;
  schema: object;
  maxOutputTokens: number;
}

export interface LlmProvider {
  readonly id: ProviderId;
  readonly model: string;
  complete(req: LlmRequest): Promise<string>;
}

export class ProviderError extends Error {
  constructor(
    message: string,
    readonly status?: number,
    readonly retryable: boolean = false,
  ) {
    super(message);
    this.name = 'ProviderError';
  }
}

function isPlainObject(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}

export function deepMerge(
  target: Record<string, unknown>,
  source: Record<string, unknown>,
): Record<string, unknown> {
  const result: Record<string, unknown> = { ...target };
  for (const [key, value] of Object.entries(source)) {
    const current = result[key];
    result[key] =
      isPlainObject(current) && isPlainObject(value) ? deepMerge(current, value) : value;
  }
  return result;
}

export async function postJson(
  url: string,
  headers: Record<string, string>,
  body: unknown,
): Promise<unknown> {
  let res: Response;
  try {
    res = await fetch(url, {
      method: 'POST',
      headers: { 'content-type': 'application/json', ...headers },
      body: JSON.stringify(body),
    });
  } catch (e) {
    throw new ProviderError(`Network error: ${String(e)}`, undefined, true);
  }
  if (!res.ok) {
    // 混雑 (429) やサーバー側の一時障害 (5xx) は時間をおけば回復しうるため、再試行対象にする
    const retryable = res.status === 429 || res.status >= 500;
    const detail = await res.text().catch(() => '');
    throw new ProviderError(
      `HTTP ${res.status}: ${extractErrorMessage(detail)}`,
      res.status,
      retryable,
    );
  }
  return res.json();
}

function extractErrorMessage(body: string): string {
  try {
    const parsed = JSON.parse(body) as {
      error?: { message?: unknown } | string;
      message?: unknown;
    };
    if (typeof parsed.error === 'string') return parsed.error;
    if (parsed.error && typeof parsed.error.message === 'string') return parsed.error.message;
    if (typeof parsed.message === 'string') return parsed.message;
  } catch {
    // JSON でなければそのまま
  }
  return body.slice(0, 300);
}
