import { MAX_PLAYBACK_RATE, RATE_TICK_MS } from '../lib/constants';
import { createLogger } from '../lib/logger';
import type { RateController } from '../lib/rate-controller';

const log = createLogger('audio');

const WATCHDOG_MAX_RESUMES = 3;
const WATCHDOG_WINDOW_MS = 5000;

export interface EnqueueItem {
  blob: Blob;
  segIdx: number;
  text: string;
}

interface Clip extends EnqueueItem {
  audio: HTMLAudioElement;
  url: string;
  duration: number | null;
  gen: number;
}

/* 合成音声の再生制御を担う */
export class AudioPlayer {
  private queue: Clip[] = [];
  private current: Clip | null = null;
  // 再生を停止した後に遅れて届く古いコールバックを無視するための世代番号
  private gen = 0;
  private selfPaused = false;
  private watchdogResumeTimes: number[] = [];
  private tickTimer: ReturnType<typeof setInterval> | null = null;
  private volume = 1.0;
  private autoRate = true;

  constructor(
    private readonly video: HTMLVideoElement,
    private readonly controller: RateController,
  ) {}

  get generation(): number {
    return this.gen;
  }

  get isPlaying(): boolean {
    return this.current !== null;
  }

  setVolume(volume: number): void {
    this.volume = volume;
    if (this.current) this.current.audio.volume = volume;
  }

  setAutoRate(enabled: boolean): void {
    this.autoRate = enabled;
    if (!enabled) this.applyRate(this.controller.getBaseRate());
  }

  applyRate(rate: number): void {
    if (this.current) this.current.audio.playbackRate = rate;
  }

  enqueue(item: EnqueueItem): void {
    if (this.current && item.segIdx <= this.current.segIdx) {
      log.debug(`enqueue dropped seg=${item.segIdx} (current=${this.current.segIdx})`);
      return;
    }
    if (this.queue.some((c) => c.segIdx === item.segIdx)) {
      log.debug(`enqueue dropped seg=${item.segIdx} (duplicate in queue)`);
      return;
    }
    const url = URL.createObjectURL(item.blob);
    
    const audio = new Audio(url);
    audio.preservesPitch = true;
    const clip: Clip = { ...item, audio, url, duration: null, gen: -1 };
    audio.addEventListener(
      'loadedmetadata',
      () => {
        if (Number.isFinite(audio.duration)) clip.duration = audio.duration;
      },
      { once: true },
    );
    const pos = this.queue.findIndex((c) => c.segIdx > clip.segIdx);
    if (pos < 0) this.queue.push(clip);
    else this.queue.splice(pos, 0, clip);
    log.debug(`enqueued seg=${item.segIdx} size=${item.blob.size}B queue=${this.queue.length}`);
    if (!this.current && !this.video.paused) this.playNext();
  }

  pause(): void {
    this.selfPaused = true;
    this.stopTick();
    this.current?.audio.pause();
  }

  resume(): void {
    this.selfPaused = false;
    if (this.current) {
      this.current.audio.play().catch((e) => log.warn('resume play() rejected:', e));
      this.startTick();
    } else if (this.queue.length > 0) {
      this.playNext();
    }
  }

  stop(): void {
    this.gen++;
    this.stopTick();
    if (this.current) {
      this.current.audio.onended = null;
      this.current.audio.onerror = null;
      this.current.audio.pause();
      URL.revokeObjectURL(this.current.url);
      this.current = null;
    }
    for (const clip of this.queue) URL.revokeObjectURL(clip.url);
    this.queue.length = 0;
    this.selfPaused = false;
  }

  /** 再生中クリップは流し切りつつ、キュー済みと今後届く合成結果を破棄する */
  invalidatePending(): void {
    this.gen++;
    if (this.current) this.current.gen = this.gen;
    for (const clip of this.queue) URL.revokeObjectURL(clip.url);
    this.queue.length = 0;
    log.debug(`invalidatePending: gen=${this.gen}, current seg=${this.current?.segIdx ?? '-'}`);
  }

  destroy(): void {
    this.stop();
  }

  private playNext(): void {
    const clip = this.queue.shift() ?? null;
    this.current = clip;
    if (!clip) {
      this.stopTick();
      return;
    }
    clip.gen = this.gen;
    const { audio } = clip;
    audio.volume = this.volume;

    let done = false;
    const cleanup = (label: string) => {
      URL.revokeObjectURL(clip.url);
      if (done || clip.gen !== this.gen) return;
      done = true;
      log.debug(`clip ended seg=${clip.segIdx} [${label}] queue=${this.queue.length}`);
      this.playNext();
    };

    audio.onended = () => cleanup('ended');
    audio.onerror = () => cleanup('error');

    // イヤホンのメディアキーが動画ではなく <audio> だけを止めることが稀にある。
    // 動画側の pause 処理を先に走らせるため setTimeout(0) 後に判定し、自分が止めておらず動画が再生中なら復帰させる。
    audio.addEventListener('pause', () => {
      if (clip.gen !== this.gen || done) return;
      setTimeout(() => {
        if (clip.gen !== this.gen || done) return;
        if (this.selfPaused || this.video.paused || audio.ended) return;
        const now = Date.now();
        this.watchdogResumeTimes = this.watchdogResumeTimes.filter(
          (t) => now - t < WATCHDOG_WINDOW_MS,
        );
        // OS 側の一時停止操作と復帰が延々と衝突するのを防ぐため、一定時間内の復帰回数を制限する
        if (this.watchdogResumeTimes.length >= WATCHDOG_MAX_RESUMES) {
          log.warn('watchdog resume cap reached, leaving audio paused');
          return;
        }
        this.watchdogResumeTimes.push(now);
        log.info('audio paused externally while video playing, resuming');
        audio.play().catch((e) => log.warn('watchdog play() rejected:', e));
      }, 0);
    });

    const start = () => {
      if (clip.gen !== this.gen || done) return;
      if (Number.isFinite(audio.duration)) clip.duration = audio.duration;
      const rate = this.currentTargetRate();
      audio.playbackRate = rate;
      log.debug(
        `playing seg=${clip.segIdx} dur=${clip.duration?.toFixed(2) ?? '?'}s rate=${rate.toFixed(2)}`,
      );
      audio.play().catch((e) => {
        log.warn('play() rejected:', e);
        cleanup('play-reject');
      });
      this.startTick();
    };

    if (Number.isFinite(audio.duration) && audio.duration > 0) start();
    else audio.addEventListener('loadedmetadata', start, { once: true });
  }

  private currentTargetRate(): number {
    if (!this.autoRate) return Math.min(this.controller.getBaseRate(), MAX_PLAYBACK_RATE);
    return this.controller.tick(this.tickInput());
  }

  private tickInput() {
    const current = this.current;
    let playing: { segIdx: number; positionSec: number; durationSec: number | null } | null = null;
    if (current) {
      const duration = current.duration ?? current.audio.duration;
      playing = {
        segIdx: current.segIdx,
        positionSec: current.audio.currentTime,
        durationSec: Number.isFinite(duration) ? duration : null,
      };
    }
    return {
      videoTime: this.video.currentTime,
      videoRate: this.video.playbackRate || 1,
      videoDuration: this.video.duration,
      playing,
      queued: this.queue.map((c) => ({ segIdx: c.segIdx, durationSec: c.duration })),
    };
  }

  private startTick(): void {
    if (this.tickTimer) return;
    this.tickTimer = setInterval(() => {
      if (!this.current || this.selfPaused || this.video.paused) return;
      if (!this.autoRate) return;
      const prev = this.current.audio.playbackRate;
      const rate = this.controller.tick(this.tickInput());
      if (Math.abs(rate - prev) > 1e-3) {
        log.debug(`rate tick seg=${this.current.segIdx}: ${prev.toFixed(2)} → ${rate.toFixed(2)}`);
      }
      this.current.audio.playbackRate = rate;
    }, RATE_TICK_MS);
  }

  private stopTick(): void {
    if (this.tickTimer) {
      clearInterval(this.tickTimer);
      this.tickTimer = null;
    }
  }
}
