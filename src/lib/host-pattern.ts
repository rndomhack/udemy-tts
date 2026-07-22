// URL から権限要求用のオリジン match pattern を作る。
// match pattern はポートを指定できず、含めると要求自体が無効になるため、ホスト名までで丸める。

export function originPattern(baseUrl: string): string | null {
  try {
    const url = new URL(baseUrl.trim());
    if (url.protocol !== 'http:' && url.protocol !== 'https:') return null;
    return `${url.protocol}//${url.hostname}/*`;
  } catch {
    return null;
  }
}
