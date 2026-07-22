// LLM の翻訳応答を寛容に解析する。訳・読み替え表とも配列形式とオブジェクト形式のどちらでも受理する

export interface ParsedTranslation {
  translations: Map<number, string>;
  pronunciationMap: Record<string, string>;
}

/** 応答から、要求したインデックスの訳と読み替え表を取り出す */
export function parseTranslationResponse(
  raw: string,
  requestedIndices: number[],
): ParsedTranslation {
  const requested = new Set(requestedIndices);
  const translations = new Map<number, string>();
  const pronunciationMap: Record<string, string> = {};

  const parsed = tryParseJson(raw);
  if (parsed === null || typeof parsed !== 'object') {
    return { translations, pronunciationMap };
  }
  const obj = parsed as Record<string, unknown>;

  const t = obj.translations;
  if (Array.isArray(t)) {
    for (const entry of t) {
      if (entry && typeof entry === 'object') {
        const idx = Number((entry as Record<string, unknown>).index);
        const text = (entry as Record<string, unknown>).translation;
        if (Number.isInteger(idx) && requested.has(idx) && typeof text === 'string' && text) {
          translations.set(idx, text);
        }
      }
    }
  } else if (t && typeof t === 'object') {
    for (const [key, value] of Object.entries(t as Record<string, unknown>)) {
      const idx = Number(key);
      if (Number.isInteger(idx) && requested.has(idx) && typeof value === 'string' && value) {
        translations.set(idx, value);
      }
    }
  }

  const p = obj.pronunciation_map ?? obj.pronunciationMap;
  if (Array.isArray(p)) {
    for (const entry of p) {
      if (entry && typeof entry === 'object') {
        const word = (entry as Record<string, unknown>).word;
        const reading = (entry as Record<string, unknown>).reading;
        if (typeof word === 'string' && word && typeof reading === 'string' && reading) {
          pronunciationMap[word] = reading;
        }
      }
    }
  } else if (p && typeof p === 'object') {
    for (const [word, reading] of Object.entries(p as Record<string, unknown>)) {
      if (word && typeof reading === 'string' && reading) pronunciationMap[word] = reading;
    }
  }

  return { translations, pronunciationMap };
}

function tryParseJson(raw: string): unknown {
  let text = raw.trim();
  // コードブロックで囲まれている場合は中身だけを取り出す
  const fence = text.match(/^```[a-zA-Z]*\s*\n?([\s\S]*?)\n?```\s*$/);
  if (fence) text = fence[1].trim();

  try {
    return JSON.parse(text);
  } catch {
    // 前後に地の文が付いていることがあるため、最初の { から最後の } までを切り出して試す
    const start = text.indexOf('{');
    const end = text.lastIndexOf('}');
    if (start >= 0 && end > start) {
      try {
        return JSON.parse(text.slice(start, end + 1));
      } catch {
        return null;
      }
    }
    return null;
  }
}
