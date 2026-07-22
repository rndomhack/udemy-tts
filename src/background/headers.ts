import { browser } from '#imports';
import { createLogger } from '../lib/logger';

// Edge TTS サーバーはハンドシェイクの UA と Origin を検査するため、Edge 相当の値へ書き換える。
// Chrome は動的ルール、Firefox は通信の書き換えで行う (使える仕組みがブラウザごとに違う)。

const log = createLogger('headers');

export const CHROMIUM_VERSION = '143';

// Edge に内蔵された読み上げ拡張になりすますための UA と Origin。古い UA が弾かれ始めたら CHROMIUM_VERSION を上げる
const EDGE_TTS_HEADERS: Record<string, string> = {
  'User-Agent': `Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/${CHROMIUM_VERSION}.0.0.0 Safari/537.36 Edg/${CHROMIUM_VERSION}.0.0.0`,
  Origin: 'chrome-extension://jdiccldimpdaibmpdkjnbmckianbfold',
};

const DNR_RULE_ID = 1001;

export async function setupEdgeTtsHeaderInterceptor(): Promise<void> {
  if (import.meta.env.FIREFOX) {
    // Firefox の動的ルールは拡張自身の通信には効かないため、通信を直接書き換える方式を使う
    browser.webRequest.onBeforeSendHeaders.addListener(
      (details) => {
        const overrideKeys = new Set(Object.keys(EDGE_TTS_HEADERS).map((k) => k.toLowerCase()));
        const filtered = (details.requestHeaders ?? []).filter(
          (h) => !overrideKeys.has(h.name.toLowerCase()),
        );
        const added = Object.entries(EDGE_TTS_HEADERS).map(([name, value]) => ({ name, value }));
        return { requestHeaders: [...filtered, ...added] };
      },
      { urls: ['wss://speech.platform.bing.com/*'] },
      ['blocking', 'requestHeaders'],
    );
    log.info('Edge TTS header interceptor registered (webRequest)');
  } else {
    const requestHeaders = Object.entries(EDGE_TTS_HEADERS).map(([header, value]) => ({
      header,
      operation: 'set',
      value,
    } as const));
    await browser.declarativeNetRequest.updateDynamicRules({
      removeRuleIds: [DNR_RULE_ID],
      addRules: [
        {
          id: DNR_RULE_ID,
          priority: 1,
          action: {
            type: 'modifyHeaders',
            requestHeaders,
          },
          condition: {
            urlFilter: '||speech.platform.bing.com/*',
            resourceTypes: ['websocket', 'xmlhttprequest'],
          },
        },
      ],
    });
    log.info('Edge TTS header interceptor registered (DNR rule 1001)');
  }
}
