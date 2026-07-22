import { LectureSession, type SessionContext } from '../src/content/session';
import { SubtitleOverlay } from '../src/content/subtitle-overlay';
import { getCourseId, getLectureId } from '../src/content/udemy-api';
import { mountWidget, unmountWidget } from '../src/content/widget';
import { createLogger, setLogLevel } from '../src/lib/logger';
import type { ExtensionSettings, GetSettingsResponse } from '../src/lib/types';
import { WordSubstituter } from '../src/lib/words';
import { sendMessage } from '../src/utils/messaging';
import { mergeSettings, settingsStorage } from '../src/utils/storage';

// コンテンツスクリプト。
// 設定の取得・購読と、講義の切替に応じたセッション・字幕・ウィジェットの生成と破棄を担う。

const log = createLogger('content');

// これらの変更は字幕の内容そのものが変わるため、ライブ適用ではなくセッションを作り直す
const RESTART_FIELDS: Array<keyof ExtensionSettings> = [
  'translateEnabled',
  'targetLanguage',
  'translatorPersonality',
  'customPersonality',
  'activeProvider',
  'ttsProvider',
];

export default defineContentScript({
  matches: ['https://*.udemy.com/course/*/learn/*'],

  async main() {
    const { settings } = await sendMessage<GetSettingsResponse>({ type: 'GET_SETTINGS' });
    setLogLevel(settings.logLevel);

    let globalWords = WordSubstituter.fromDict(settings.customWords ?? {});
    const ctx: SessionContext = {
      settings,
      globalWords: () => globalWords,
      lastVideoRate: { value: 1 },
    };

    let currentSession: LectureSession | null = null;
    let currentOverlay: SubtitleOverlay | null = null;
    let currentLectureId: string | null = null;

    let persistTimer: ReturnType<typeof setTimeout> | null = null;
    let pendingPatch: Partial<ExtensionSettings> = {};
    function persist(patch: Partial<ExtensionSettings>): void {
      pendingPatch = { ...pendingPatch, ...patch };
      if (persistTimer) clearTimeout(persistTimer);
      persistTimer = setTimeout(() => {
        const toSave = pendingPatch;
        pendingPatch = {};
        void settingsStorage
          .getValue()
          .then((current) => settingsStorage.setValue(mergeSettings({ ...current, ...toSave })));
      }, 400);
    }

    const pickPlayerVideo = (): HTMLVideoElement | null =>
      document.querySelector<HTMLVideoElement>('video[id^="lecture-"]') ??
      document.querySelector<HTMLVideoElement>('video');

    function startSession(video: HTMLVideoElement): void {
      const lectureId = getLectureId();
      const courseId = getCourseId();
      if (!lectureId || !courseId) return;
      if (lectureId === currentLectureId && currentSession) return;

      currentSession?.destroy();
      currentOverlay?.destroy();
      currentLectureId = lectureId;
      currentSession = new LectureSession(lectureId, courseId, video, ctx);

      currentOverlay = new SubtitleOverlay({
        style: ctx.settings.subtitleStyle,
        position: ctx.settings.subtitlePosition,
        onPositionChange: (r) => persist({ subtitlePosition: r }),
      });
      currentOverlay.mount();
      const overlay = currentOverlay;

      currentSession.setSubtitleCallback((text) => overlay.setText(text));

      void currentSession.load();
      mountWidget({ session: currentSession, persist, restart: restartSession });
      log.info(`session started: lecture=${lectureId}, course=${courseId}`);
    }

    function endSession(): void {
      if (!currentSession && currentLectureId === null) return;
      currentSession?.destroy();
      currentOverlay?.destroy();
      currentSession = null;
      currentOverlay = null;
      currentLectureId = null;
      unmountWidget();
    }

    function restartSession(): void {
      endSession();
      const video = pickPlayerVideo();
      if (video) startSession(video);
    }

    // ページとは別の実行環境で動くため遷移を直接追えない。講義切替は共有 DOM への新しい video 要素の追加を唯一の合図にする
    new MutationObserver((mutations) => {
      for (const m of mutations) {
        for (const node of m.addedNodes) {
          if (!(node instanceof HTMLElement)) continue;
          const video =
            node instanceof HTMLVideoElement ? node : node.querySelector<HTMLVideoElement>('video');
          if (video) {
            startSession(video);
            return;
          }
        }
      }
      // 動画のない講義 (テスト等) へ移ると新しい video 要素が現れないため、講義の変化を見て古い読み上げを終わらせる
      if (currentSession && getLectureId() !== currentLectureId) {
        log.info(`left lecture ${currentLectureId} (now ${getLectureId() ?? 'none'}), ending session`);
        endSession();
      }
    }).observe(document.body, { childList: true, subtree: true });

    const initialVideo = pickPlayerVideo();
    if (initialVideo) startSession(initialVideo);

    settingsStorage.watch((newValue) => {
      const merged = mergeSettings(newValue);
      const needsRestart = RESTART_FIELDS.some((f) => merged[f] !== ctx.settings[f]);
      const masterChanged = merged.enabled !== ctx.settings.enabled;

      const subtitleEnabledChanged =
        merged.subtitleOverlayEnabled !== ctx.settings.subtitleOverlayEnabled;
      const subtitleStyleChanged =
        JSON.stringify(merged.subtitleStyle) !== JSON.stringify(ctx.settings.subtitleStyle);
      const subtitlePositionChanged =
        JSON.stringify(merged.subtitlePosition) !== JSON.stringify(ctx.settings.subtitlePosition);
      Object.assign(ctx.settings, merged);
      setLogLevel(merged.logLevel);
      globalWords = WordSubstituter.fromDict(merged.customWords ?? {});

      if (needsRestart) {
        log.info('settings changed (restart fields), restarting session');
        restartSession();
        return;
      }
      const session = currentSession;
      if (!session) return;
      if (masterChanged) session.setEnabled(merged.enabled);
      session.setVolume(merged.ttsVolume);
      session.setBaseRate(merged.ttsRate);
      session.setAutoRate(merged.autoRateAdjust);
      session.setAutoRateMode(merged.autoRateMode);
      session.pitch = merged.ttsPitch;
      if (merged.ttsEnabled !== session.ttsEnabled) session.setTtsEnabled(merged.ttsEnabled);
      if (subtitleEnabledChanged) session.setSubtitleEnabled(merged.subtitleOverlayEnabled);
      if (subtitleStyleChanged) currentOverlay?.setStyle(merged.subtitleStyle);
      if (subtitlePositionChanged) currentOverlay?.setPosition(merged.subtitlePosition);
    });
  },
});
