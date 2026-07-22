import {
  isMtProvider,
  PREFETCH_AHEAD,
  RATE_LAG_BOOST_SEC_NATURAL,
  RATE_LAG_BOOST_SEC_STRONG,
  RATE_LAG_GAIN_NATURAL,
  RATE_LAG_GAIN_STRONG,
  RATE_LOOKAHEAD_NATURAL,
  RATE_LOOKAHEAD_STRONG,
  RATE_STEP_BOOST_FACTOR_NATURAL,
  RATE_STEP_BOOST_FACTOR_STRONG,
  SEEK_THRESHOLD_SEC,
  TTS_AUDIO_BYTES_PER_SEC,
} from '../lib/constants';
import { createLogger } from '../lib/logger';
import { RateController } from '../lib/rate-controller';
import type {
  AutoRateMode,
  ExtensionSettings,
  SynthesizeResponse,
  TranslateResponse,
  VttSegment,
} from '../lib/types';
import { activeSegmentIndex, subtitleTextAt } from '../lib/subtitle';
import { mergeCuesIntoSegments, parseVtt } from '../lib/vtt';
import { WordSubstituter } from '../lib/words';
import { audioDurationSec } from '../lib/audio-duration';
import { audioToBytes, bytesToAudioBlob } from '../utils/audio-codec';
import { sendMessage } from '../utils/messaging';
import { AudioPlayer, type EnqueueItem } from './audio-player';
import {
  fetchCourseInfo,
  fetchLectureData,
  fetchVttText,
  localeToLang,
  pickCaption,
  toLocaleId,
} from './udemy-api';

const log = createLogger('session');

export interface SessionContext {
  settings: ExtensionSettings;
  globalWords: () => WordSubstituter;
  lastVideoRate: { value: number };
}

/* 講義ごとの字幕取得・翻訳・音声合成・再生を統括する */
export class LectureSession {
  private active = true;
  private loaded = false;
  private loading = false;

  private segments: VttSegment[] = [];
  private translations: Record<number, string> = {};
  sourceLang = 'en';
  private localDict: Record<string, string> = {};
  private localSubstituter = new WordSubstituter([]);

  private awaitingTtsIdx = -1;
  private lastTriggeredIdx = -1;
  private lastVideoTime = 0;
  private warmupPending = false;

  private translationTasks = new Map<number, Promise<void>>();
  private synthTasks = new Map<number, Promise<EnqueueItem | null>>();

  readonly controller: RateController;
  readonly player: AudioPlayer;

  enabled: boolean;
  ttsEnabled: boolean;
  autoRateAdjust: boolean;
  volume: number;
  pitch: number;
  translateEnabled: boolean;
  subtitleEnabled: boolean;

  private lastSubtitleText: string | null = null;
  private onSubtitle?: (text: string | null) => void;

  private readonly onTimeUpdate = () => this.handleTimeUpdate();
  private readonly onSeeking = () => this.handleSeeking();
  private readonly onPause = () => this.player.pause();
  private readonly onPlay = () => {
    if (this.ttsActive) this.player.resume();
  };
  private readonly onRateChange = () => this.handleRateChange();
  private readonly onLoadedMetadata = () => {
    if (!this.warmupPending) return;
    this.warmupPending = false;
    this.warmupSynthesis(this.video.currentTime);
  };

  constructor(
    readonly lectureId: string,
    readonly courseId: string,
    private readonly video: HTMLVideoElement,
    private readonly ctx: SessionContext,
  ) {
    const s = ctx.settings;
    this.enabled = s.enabled;
    this.ttsEnabled = s.ttsEnabled;
    this.autoRateAdjust = s.autoRateAdjust;
    this.volume = s.ttsVolume;
    this.pitch = s.ttsPitch;
    this.translateEnabled = s.translateEnabled && this.hasApiKey();
    this.subtitleEnabled = s.subtitleOverlayEnabled;

    this.controller = new RateController({
      baseRate: s.ttsRate,
      feedForwardVideoRate: s.ttsProvider === 'voicevox',
    });
    this.applyAutoRateMode(s.autoRateMode);
    this.player = new AudioPlayer(video, this.controller);
    this.player.setVolume(this.volume);
    this.player.setAutoRate(this.autoRateAdjust);

    video.addEventListener('timeupdate', this.onTimeUpdate);
    video.addEventListener('seeking', this.onSeeking);
    video.addEventListener('pause', this.onPause);
    video.addEventListener('play', this.onPlay);
    video.addEventListener('ratechange', this.onRateChange);
    video.addEventListener('loadedmetadata', this.onLoadedMetadata);
  }

  destroy(): void {
    if (!this.active) return;
    this.active = false;
    this.video.removeEventListener('timeupdate', this.onTimeUpdate);
    this.video.removeEventListener('seeking', this.onSeeking);
    this.video.removeEventListener('pause', this.onPause);
    this.video.removeEventListener('play', this.onPlay);
    this.video.removeEventListener('ratechange', this.onRateChange);
    this.video.removeEventListener('loadedmetadata', this.onLoadedMetadata);
    this.player.destroy();
    log.info(`session destroyed: lecture=${this.lectureId}`);
  }

  hasApiKey(): boolean {
    const s = this.ctx.settings;
    return isMtProvider(s.activeProvider) || !!s.providers[s.activeProvider]?.apiKey;
  }

  private get ttsActive(): boolean {
    return this.enabled && this.ttsEnabled;
  }

  private get subActive(): boolean {
    return this.enabled && this.subtitleEnabled;
  }

  setEnabled(on: boolean): void {
    this.enabled = on;
    this.applyActivation();
  }

  setTtsEnabled(ttsEnabled: boolean): void {
    this.ttsEnabled = ttsEnabled;
    this.applyActivation();
  }

  setVolume(volume: number): void {
    this.volume = volume;
    this.player.setVolume(volume);
  }

  setBaseRate(rate: number): void {
    this.controller.setBaseRate(rate);
    if (!this.autoRateAdjust) this.player.applyRate(rate);
  }

  setAutoRate(enabled: boolean): void {
    this.autoRateAdjust = enabled;
    this.player.setAutoRate(enabled);
  }

  setAutoRateMode(mode: AutoRateMode): void {
    this.applyAutoRateMode(mode);
  }

  private applyActivation(): void {
    if ((this.ttsActive || this.subActive) && !this.loaded && !this.loading) {
      void this.load();
    }
    if (!this.ttsActive) this.player.stop();
    if (!this.subActive) {
      this.onSubtitle?.(null);
    } else if (this.loaded) {
      this.updateSubtitle(this.video.currentTime);
    }
  }

  private applyAutoRateMode(mode: AutoRateMode): void {
    if (mode === 'strong') {
      this.controller.configure({
        gain: RATE_LAG_GAIN_STRONG,
        lookahead: RATE_LOOKAHEAD_STRONG,
        lagBoostSec: RATE_LAG_BOOST_SEC_STRONG,
        stepBoostFactor: RATE_STEP_BOOST_FACTOR_STRONG,
      });
    } else {
      this.controller.configure({
        gain: RATE_LAG_GAIN_NATURAL,
        lookahead: RATE_LOOKAHEAD_NATURAL,
        lagBoostSec: RATE_LAG_BOOST_SEC_NATURAL,
        stepBoostFactor: RATE_STEP_BOOST_FACTOR_NATURAL,
      });
    }
  }

  setSubtitleCallback(cb: (text: string | null) => void): void {
    this.onSubtitle = cb;
  }

  setSubtitleEnabled(on: boolean): void {
    this.subtitleEnabled = on;
    this.applyActivation();
  }

  private updateSubtitle(t: number): void {
    if (!this.subActive || !this.onSubtitle) return;
    const idx = activeSegmentIndex(this.segments, t);
    if (
      idx >= 0 &&
      this.translateEnabled &&
      this.translations[idx] === undefined &&
      this.video.readyState >= HTMLMediaElement.HAVE_METADATA
    ) {
      void this.ensureTranslation(idx).then(() => {
        if (activeSegmentIndex(this.segments, this.video.currentTime) === idx) {
          this.emitSubtitle(this.video.currentTime);
        }
      });
    }
    this.emitSubtitle(t);
  }

  private emitSubtitle(t: number): void {
    const text = subtitleTextAt({ segments: this.segments, translations: this.translations }, t);
    if (text === this.lastSubtitleText) return;
    this.lastSubtitleText = text;
    this.onSubtitle?.(text);
  }

  async load(): Promise<void> {
    if (!this.ttsActive && !this.subActive) return;
    if (this.loaded || this.loading) return;
    this.loading = true;
    try {
      const s = this.ctx.settings;
      const [course, lecture] = await Promise.all([
        fetchCourseInfo(this.courseId),
        fetchLectureData(this.courseId, this.lectureId),
      ]);
      if (!this.active) return;

      this.sourceLang = course.locale ? localeToLang(course.locale) : 'en';
      const captionLocale = this.translateEnabled
        ? course.locale || 'en_US'
        : toLocaleId(s.targetLanguage);
      const caption = pickCaption(lecture.captions, captionLocale);
      const vttText = await fetchVttText(caption);
      if (!this.active) return;

      this.segments = mergeCuesIntoSegments(parseVtt(vttText));
      this.controller.setSegments(this.segments);
      this.loaded = true;
      log.info(
        `parsed ${this.segments.length} segments ` +
          `(caption=${caption.locale_id}, source=${this.sourceLang})`,
      );

      if (!this.translateEnabled) {
        this.segments.forEach((seg, i) => {
          this.translations[i] = seg.text;
        });
        this.requestWarmup();
        this.updateSubtitle(this.video.currentTime);
        return;
      }

      // 機械翻訳の場合は一括翻訳しても品質が変わらないため行わない
      if (isMtProvider(s.activeProvider)) {
        this.requestWarmup();
        this.updateSubtitle(this.video.currentTime);
        return;
      }

      const texts = this.segments.map((seg) => seg.text);
      const cacheMeta = {
        courseId: this.courseId,
        lectureId: this.lectureId,
        courseTitle: course.title,
        lectureTitle: lecture.title,
      };

      const probe = await sendMessage<TranslateResponse>({
        type: 'TRANSLATE',
        texts,
        sourceLang: this.sourceLang,
        targetLang: s.targetLanguage,
        cacheMeta,
        cacheOnly: true,
      });
      if (!this.active) return;
      if (probe.cached) {
        this.applyTranslations(probe);
        log.info(`translations loaded from cache: ${probe.translations.length} segments`);
        this.requestWarmup();
        this.updateSubtitle(this.video.currentTime);
        return;
      }

      this.requestWarmup();
      this.updateSubtitle(this.video.currentTime);

      const response = await sendMessage<TranslateResponse>({
        type: 'TRANSLATE',
        texts,
        sourceLang: this.sourceLang,
        targetLang: s.targetLanguage,
        cacheMeta,
      });
      if (!this.active) return;

      this.applyTranslations(response);
      log.info(
        `translations loaded: ${response.translations.length} segments, ` +
          `${Object.keys(response.pronunciationMap).length} pronunciation entries`,
      );

      if (this.ttsActive) {
        this.player.invalidatePending();
        this.synthTasks.clear();
        this.awaitingTtsIdx = -1;
        this.lastTriggeredIdx = this.segmentIndexAt(this.video.currentTime) - 1;
        this.requestWarmup();
      }
      this.updateSubtitle(this.video.currentTime);
    } catch (e) {
      log.error('load failed:', e);
    } finally {
      this.loading = false;
    }
  }

  private applyTranslations(response: TranslateResponse): void {
    response.translations.forEach((text, i) => {
      this.translations[i] = text;
    });
    this.localDict = { ...this.localDict, ...response.pronunciationMap };
    this.localSubstituter = WordSubstituter.fromDict(this.localDict);
  }

  private handleTimeUpdate(): void {
    this.lastVideoTime = this.video.currentTime;
    if (!this.active) return;
    this.updateSubtitle(this.video.currentTime);
    if (!this.ttsActive || this.video.paused) return;
    if (this.video.playbackRate > 0) this.ctx.lastVideoRate.value = this.video.playbackRate;
    const idx = this.segmentIndexAt(this.video.currentTime);
    if (idx < 0 || idx === this.lastTriggeredIdx) return;
    this.lastTriggeredIdx = idx;
    this.triggerSegment(idx);
  }

  private handleSeeking(): void {
    const delta = Math.abs(this.video.currentTime - this.lastVideoTime);
    if (delta < SEEK_THRESHOLD_SEC) return;
    this.player.stop();
    this.controller.reset();
    this.lastTriggeredIdx = -1;
    this.awaitingTtsIdx = -1;
    log.info(`seek detected (Δ${delta.toFixed(1)}s), queue cleared`);
    if (this.loaded) {
      this.requestWarmup();
      this.updateSubtitle(this.video.currentTime);
    }
  }

  /** video要素の速度が変わったら音声合成の先読みキャッシュを破棄して再合成する */
  private handleRateChange(): void {
    const rate = this.video.playbackRate;
    // 動画の読み込み中は速度が 0→実値→0 のような変化が起こるため、確定値のみ信頼する
    if (rate <= 0 || this.video.readyState < HTMLMediaElement.HAVE_METADATA) return;
    if (Math.abs(rate - this.ctx.lastVideoRate.value) < 1e-3) return;
    log.info(`playbackRate changed ${this.ctx.lastVideoRate.value} → ${rate}`);
    this.ctx.lastVideoRate.value = rate;
    if (!this.active || !this.ttsActive || !this.loaded) return;
    if (this.ctx.settings.ttsProvider === 'voicevox') return;
    const base = Math.max(this.lastTriggeredIdx, this.segmentIndexAt(this.video.currentTime) - 1);
    for (const idx of [...this.synthTasks.keys()]) {
      if (idx > base) this.synthTasks.delete(idx);
    }
    this.prefetchAhead(base);
  }

  private segmentIndexAt(t: number): number {
    let idx = -1;
    for (let i = 0; i < this.segments.length; i++) {
      if (this.segments[i].startTime <= t) idx = i;
      else break;
    }
    return idx;
  }

  private triggerSegment(idx: number): void {
    log.debug(`segment ${idx} triggered: "${this.segments[idx]?.text.slice(0, 40)}..."`);
    this.prefetchAhead(idx);
    if (this.translations[idx] !== undefined) {
      void this.speak(this.translations[idx], idx);
    } else {
      this.awaitingTtsIdx = idx;
      void this.ensureTranslation(idx);
    }
  }

  private ensureTranslation(idx: number): Promise<void> {
    if (this.translations[idx] !== undefined) return Promise.resolve();
    let task = this.translationTasks.get(idx);
    if (!task) {
      task = this.translateOnDemand(idx);
      this.translationTasks.set(idx, task);
    }
    return task;
  }

  private async translateOnDemand(idx: number): Promise<void> {
    if (!this.translateEnabled) return;
    const s = this.ctx.settings;
    const original = this.segments[idx].text;
    let translated: string;
    try {
      const response = await sendMessage<TranslateResponse>({
        type: 'TRANSLATE',
        texts: [original],
        sourceLang: this.sourceLang,
        targetLang: s.targetLanguage,
      });
      if (!this.active) return;
      const t = response.translations[0];
      if (t === undefined) {
        this.translationTasks.delete(idx);
        return;
      }
      translated = t;
      if (Object.keys(response.pronunciationMap).length > 0) {
        this.localDict = { ...response.pronunciationMap, ...this.localDict };
        this.localSubstituter = WordSubstituter.fromDict(this.localDict);
      }
      log.debug(`on-demand translation done for segment ${idx}`);
    } catch (e) {
      if (this.active) log.warn(`on-demand translation failed for segment ${idx} (skipped):`, e);
      this.translationTasks.delete(idx);
      return;
    }
    if (this.translations[idx] === undefined) this.translations[idx] = translated;
    if (this.awaitingTtsIdx === idx) {
      this.awaitingTtsIdx = -1;
      void this.speak(this.translations[idx], idx);
    }
  }

  private requestWarmup(): void {
    if (this.video.readyState >= HTMLMediaElement.HAVE_METADATA) {
      this.warmupSynthesis(this.video.currentTime);
    } else {
      this.warmupPending = true;
    }
  }

  private warmupSynthesis(t: number): void {
    const idx = this.segmentIndexAt(t);
    this.prefetchAhead(idx < 0 ? -1 : idx - 1);
  }

  private prefetchAhead(fromIdx: number): void {
    if (!this.ttsActive) return;
    const last = Math.min(fromIdx + PREFETCH_AHEAD, this.segments.length - 1);
    for (let i = fromIdx + 1; i <= last; i++) {
      if (this.synthTasks.has(i)) continue;
      log.debug(`prefetching segment ${i}`);
      void this.prefetchSegment(i);
    }
  }

  private async prefetchSegment(idx: number): Promise<void> {
    await this.ensureTranslation(idx);
    const text = this.translations[idx];
    if (!this.active || !this.ttsActive || text === undefined) return;
    void this.synthesizeSegment(idx, text);
  }

  private async speak(text: string, segIdx: number): Promise<void> {
    if (!this.active || !this.ttsActive || !text) return;
    const gen = this.player.generation;
    const item = await this.synthesizeSegment(segIdx, text);
    if (!item || !this.active || !this.ttsActive || this.player.generation !== gen) return;
    this.player.enqueue(item);
  }

  /**
   * 遷移を前提とした動画の再生速度
   * 遷移直後は再生速度が1なるため、再生中か1以外を信用し、それ以外はフォールバックする。
   */
  private effectiveVideoRate(): number {
    const live = this.video.playbackRate;
    const ready = this.video.readyState >= HTMLMediaElement.HAVE_METADATA;
    if (live > 0 && ready && (!this.video.paused || live !== 1)) return live;
    return this.ctx.lastVideoRate.value || 1;
  }

  private synthesizeSegment(segIdx: number, text: string): Promise<EnqueueItem | null> {
    let task = this.synthTasks.get(segIdx);
    if (!task) {
      task = this.doSynthesize(segIdx, text);
      this.synthTasks.set(segIdx, task);
    }
    return task;
  }

  private async doSynthesize(segIdx: number, text: string): Promise<EnqueueItem | null> {
    const s = this.ctx.settings;
    const substituted = this.ctx.globalWords().merge(this.localSubstituter).substitute(text);
    const synthesisRate = this.effectiveVideoRate();
    try {
      const response = await sendMessage<SynthesizeResponse>({
        type: 'SYNTHESIZE',
        text: substituted,
        voice: s.ttsVoice,
        rate: synthesisRate,
        pitch: this.pitch,
        volume: 1.0,
      });
      if (!response.success || !response.audio) {
        log.error(`synthesize failed for segment ${segIdx}:`, response.error);
        this.synthTasks.delete(segIdx);
        return null;
      }
      const bytes = audioToBytes(response.audio);
      const audioSec = audioDurationSec(bytes) ?? bytes.length / TTS_AUDIO_BYTES_PER_SEC;
      this.controller.setMeasuredNaturalSec(segIdx, audioSec * synthesisRate);
      return { blob: bytesToAudioBlob(bytes), segIdx, text: substituted };
    } catch (e) {
      log.error(`synthesize error for segment ${segIdx}:`, e);
      this.synthTasks.delete(segIdx);
      return null;
    }
  }
}
