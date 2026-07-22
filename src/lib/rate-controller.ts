import {
  MAX_PLAYBACK_RATE,
  RATE_LAG_BOOST_SEC_NATURAL,
  RATE_LAG_GAIN_NATURAL,
  RATE_LOOKAHEAD_NATURAL,
  RATE_MAX_ALLOWANCE_SEC,
  RATE_STEP_BOOST_FACTOR_NATURAL,
  RATE_STEP_PER_TICK,
} from './constants';

export interface RateSegmentInput {
  startTime: number;
  endTime: number;
}

export interface TickInput {
  videoTime: number;
  videoRate: number;
  videoDuration: number;
  playing: { segIdx: number; positionSec: number; durationSec: number | null } | null;
  queued: Array<{ segIdx: number; durationSec: number | null }>;
}

export interface RateControllerOptions {
  baseRate: number;
  maxRate?: number;
  step?: number;
  lookahead?: number;
  gain?: number;
  maxAllowance?: number;
  lagBoostSec?: number;
  stepBoostFactor?: number;
  feedForwardVideoRate?: boolean;
}

/* 合成音声の再生レートを字幕タイムラインと実測音声長から算出する */
export class RateController {
  currentRate: number;

  private baseRate: number;
  private readonly maxRate: number;
  private readonly step: number;
  private readonly maxAllowance: number;
  private lookahead: number;
  private gain: number;
  private lagBoostSec: number;
  private stepBoostFactor: number;
  private readonly feedForwardVideoRate: boolean;

  private segments: Array<{ startTime: number; slotSec: number }> = [];

  private readonly naturalSecByIdx = new Map<number, number>();

  constructor(opts: RateControllerOptions) {
    this.baseRate = opts.baseRate;
    this.maxRate = opts.maxRate ?? MAX_PLAYBACK_RATE;
    this.step = opts.step ?? RATE_STEP_PER_TICK;
    this.maxAllowance = opts.maxAllowance ?? RATE_MAX_ALLOWANCE_SEC;
    this.lookahead = opts.lookahead ?? RATE_LOOKAHEAD_NATURAL;
    this.gain = opts.gain ?? RATE_LAG_GAIN_NATURAL;
    this.lagBoostSec = opts.lagBoostSec ?? RATE_LAG_BOOST_SEC_NATURAL;
    this.stepBoostFactor = opts.stepBoostFactor ?? RATE_STEP_BOOST_FACTOR_NATURAL;
    this.feedForwardVideoRate = opts.feedForwardVideoRate ?? false;
    this.currentRate = this.baseRate;
  }

  setSegments(segments: RateSegmentInput[]): void {
    this.segments = segments.map((s) => ({
      startTime: s.startTime,
      slotSec: Math.max(s.endTime - s.startTime, 0.1),
    }));
    this.naturalSecByIdx.clear();
  }

  setMeasuredNaturalSec(idx: number, naturalSec: number): void {
    if (naturalSec <= 0) return;
    this.naturalSecByIdx.set(idx, naturalSec);
  }

  setBaseRate(rate: number): void {
    this.baseRate = rate;
    if (this.currentRate < rate) this.currentRate = rate;
  }

  configure(opts: {
    gain?: number;
    lookahead?: number;
    lagBoostSec?: number;
    stepBoostFactor?: number;
  }): void {
    if (opts.gain !== undefined) this.gain = opts.gain;
    if (opts.lookahead !== undefined) this.lookahead = opts.lookahead;
    if (opts.lagBoostSec !== undefined) this.lagBoostSec = opts.lagBoostSec;
    if (opts.stepBoostFactor !== undefined) this.stepBoostFactor = opts.stepBoostFactor;
  }

  getBaseRate(): number {
    return this.baseRate;
  }

  reset(): void {
    this.currentRate = this.baseRate;
  }

  tick(input: TickInput): number {
    const floor = this.floorRate(input.videoRate);
    const { target, excess } = this.computeTarget(input, floor);
    // 遅れが大きいときは目標速度へ速く近づけるため、1 回の更新でのレート変化量を増やす
    const step =
      excess !== null && excess >= this.lagBoostSec ? this.step * this.stepBoostFactor : this.step;
    const delta = Math.min(Math.max(target - this.currentRate, -step), step);
    // 音声が先行しても下限を割り込む減速はしない
    this.currentRate = Math.min(Math.max(this.currentRate + delta, floor), this.maxRate);
    return this.currentRate;
  }

  private floorRate(videoRate: number): number {
    if (!this.feedForwardVideoRate) return this.baseRate;
    return this.baseRate * (videoRate > 0 ? videoRate : 1);
  }

  private computeTarget(input: TickInput, floor: number): { target: number; excess: number | null } {
    const n = this.segments.length;
    if (n === 0) return { target: floor, excess: null };

    const { videoTime, videoRate, videoDuration, playing, queued } = input;
    const rate = videoRate > 0 ? videoRate : 1;

    let j: number;
    if (playing) {
      j = playing.segIdx;
    } else if (queued.length > 0) {
      j = queued[0].segIdx;
    } else {
      j = this.segments.findIndex((s) => s.startTime >= videoTime);
      if (j < 0) return { target: floor, excess: null };
    }
    const segJ = this.segments[j];

    let lag: number | null = null;
    if (playing && segJ) {
      const p =
        playing.durationSec !== null && playing.durationSec > 0
          ? Math.min(Math.max(playing.positionSec / playing.durationSec, 0), 1)
          : 0;
      lag = videoTime - (segJ.startTime + p * segJ.slotSec);
    } else if (queued.length > 0 && segJ) {
      lag = videoTime - segJ.startTime;
    }

    let excess: number | null = null;
    let lagTarget = floor;
    if (lag !== null) {
      excess = lag - this.allowanceAt(j, videoDuration);
      if (excess > 0) {
        lagTarget = floor + this.gain * excess;
      }
    }

    // 講義の残り時間内に読み切れる最低レートを保証する
    let endReq = 0;
    if (Number.isFinite(videoDuration) && videoDuration > 0) {
      const queuedByIdx = new Map(queued.map((q) => [q.segIdx, q.durationSec]));
      let totalAudio = 0;
      for (let i = j; i < n; i++) {
        if (playing && i === playing.segIdx && playing.durationSec !== null) {
          totalAudio += Math.max(playing.durationSec - playing.positionSec, 0);
          continue;
        }
        const q = queuedByIdx.get(i);
        if (q !== undefined && q !== null && Number.isFinite(q)) {
          totalAudio += q;
          continue;
        }
        const natural = this.naturalSecByIdx.get(i) ?? this.segments[i].slotSec;
        totalAudio += natural / rate;
      }
      const endBudget = (videoDuration - videoTime) / rate;
      endReq = endBudget > 0.1 ? totalAudio / endBudget : this.maxRate;
    }

    const target = Math.min(Math.max(lagTarget, endReq, floor), this.maxRate);
    return { target, excess };
  }

  /** この先のセグメントにある字幕どうしの間の無音を平均し、遅れとみなさず許容できる 1 セグメントあたりの秒数を返す */
  private allowanceAt(j: number, videoDuration: number): number {
    const n = this.segments.length;
    const endIdx = Math.min(j + this.lookahead, n);
    const count = endIdx - j;
    if (count <= 0) return 0;
    const last = this.segments[n - 1];
    const windowEnd =
      endIdx < n
        ? this.segments[endIdx].startTime
        : Number.isFinite(videoDuration) && videoDuration > 0
          ? videoDuration
          : last.startTime + last.slotSec;
    const windowSpan = windowEnd - this.segments[j].startTime;
    let subtitleSpan = 0;
    for (let i = j; i < endIdx; i++) subtitleSpan += this.segments[i].slotSec;
    return Math.min(Math.max(windowSpan - subtitleSpan, 0) / count, this.maxAllowance);
  }
}
