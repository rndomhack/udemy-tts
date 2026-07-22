import {
  cacheClear,
  cacheDelete,
  cacheList,
  cacheStatusForLecture,
} from '../src/background/cache-db';
import { setupEdgeTtsHeaderInterceptor } from '../src/background/headers';
import { handleSynthesize } from '../src/background/synth';
import { handleTestProvider, handleTranslate } from '../src/background/translate';
import { handleGetVoices } from '../src/background/voices';
import { handleVoicevoxSpeakers } from '../src/background/voicevox';
import { createLogger, setLogLevel } from '../src/lib/logger';
import type { ExtensionMessage } from '../src/lib/types';
import { registerMessageRouter } from '../src/utils/messaging';
import { getSettings, mergeSettings, settingsStorage } from '../src/utils/storage';

// バックグラウンドスクリプト。
// 各メッセージを対応するハンドラへ振り分ける。

const log = createLogger('background');

export default defineBackground({
  type: 'module',
  main() {
    setupEdgeTtsHeaderInterceptor().catch((e) =>
      console.error('[UdemyTTS:background] header interceptor setup failed:', e),
    );

    void getSettings().then((s) => setLogLevel(s.logLevel));
    settingsStorage.watch((s) => setLogLevel(mergeSettings(s).logLevel));

    browser.action.onClicked.addListener(() => {
      void browser.runtime.openOptionsPage();
    });

    registerMessageRouter(
      (msg: ExtensionMessage) => {
        switch (msg?.type) {
          case 'GET_SETTINGS':
            return async () => ({ settings: await getSettings() });
          case 'TRANSLATE':
            return () => handleTranslate(msg);
          case 'SYNTHESIZE':
            return () => handleSynthesize(msg);
          case 'GET_VOICES':
            return () => handleGetVoices();
          case 'GET_VOICEVOX_SPEAKERS':
            return async () => handleVoicevoxSpeakers((await getSettings()).voicevox);
          case 'CACHE_LIST':
            return async () => ({ entries: await cacheList() });
          case 'CACHE_STATUS':
            return async () => ({
              entries: await cacheStatusForLecture(msg.courseId, msg.lectureId),
            });
          case 'CACHE_DELETE':
            return async () => {
              await cacheDelete(msg.keys);
              return { success: true };
            };
          case 'CACHE_CLEAR':
            return async () => {
              await cacheClear();
              return { success: true };
            };
          case 'TEST_PROVIDER':
            return () => handleTestProvider();
          case 'OPEN_OPTIONS':
            return async () => {
              await browser.runtime.openOptionsPage();
              return { success: true };
            };
          // 未知のメッセージには応答せず素通しする (offscreen 宛などを妨げないため)
          default:
            return undefined;
        }
      },
      (e, msg) => {
        log.error(`handler failed for ${msg?.type}:`, e);
        return { success: false, error: e instanceof Error ? e.message : String(e) };
      },
    );
  },
});
