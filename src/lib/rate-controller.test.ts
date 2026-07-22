import { describe, expect, it } from 'vitest';
import { RateController } from './rate-controller';

// 一定間隔のセグメントを作る。interval が開始間隔、slot が字幕の表示長で、その差が無音になる
function makeSegments(n: number, interval = 10, slot = 8) {
  return Array.from({ length: n }, (_, i) => ({
    startTime: i * interval,
    endTime: i * interval + slot,
  }));
}

function makeController(baseRate = 1.0) {
  return new RateController({ baseRate, step: 0.1, gain: 0.25 });
}

const playing = (segIdx: number, positionSec: number, durationSec: number | null) => ({
  segIdx,
  positionSec,
  durationSec,
});

const tickWith = (
  over: Partial<Parameters<RateController['tick']>[0]>,
): Parameters<RateController['tick']>[0] => ({
  videoTime: 0,
  videoRate: 1,
  videoDuration: 1000,
  playing: null,
  queued: [],
  ...over,
});

describe('RateController', () => {
  it('returns baseRate when there are no segments', () => {
    const rc = makeController(1.2);
    expect(rc.tick(tickWith({}))).toBeCloseTo(1.2);
  });

  it('stays at baseRate while lag is within allowance', () => {
    const rc = makeController();
    rc.setSegments(makeSegments(20));
    const rate = rc.tick(tickWith({ videoTime: 5, playing: playing(0, 4, 8) }));
    expect(rate).toBeCloseTo(1.0);
  });

  it('accelerates proportionally once lag exceeds allowance', () => {
    const rc = makeController();
    rc.setSegments(makeSegments(20));
    const input = tickWith({ videoTime: 4, playing: playing(0, 0, 8) });
    expect(rc.tick(input)).toBeCloseTo(1.1);
    expect(rc.tick(input)).toBeCloseTo(1.2);
    for (let i = 0; i < 20; i++) rc.tick(input);
    expect(rc.currentRate).toBeCloseTo(1.5);
  });

  it('dense subtitles (no gaps) leave no allowance', () => {
    const rc = makeController();
    rc.setSegments(makeSegments(20, 10, 10));
    const input = tickWith({ videoTime: 1, playing: playing(0, 0, 8) });
    expect(rc.tick(input)).toBeCloseTo(1.1);
    for (let i = 0; i < 10; i++) rc.tick(input);
    expect(rc.currentRate).toBeCloseTo(1.25);
  });

  it('boosts the step by the NATURAL factor (1.5) when the excess over allowance reaches 3s', () => {
    const rc = makeController();
    rc.setSegments(makeSegments(20));
    const input = tickWith({ videoTime: 6, playing: playing(0, 0, 8) });
    expect(rc.tick(input)).toBeCloseTo(1.15);
  });

  it('boosts the step by the STRONG factor (2) after configure', () => {
    const rc = makeController();
    rc.configure({ stepBoostFactor: 2 });
    rc.setSegments(makeSegments(20));
    const input = tickWith({ videoTime: 6, playing: playing(0, 0, 8) });
    expect(rc.tick(input)).toBeCloseTo(1.2);
  });

  it('boosts at a smaller excess when the threshold is lowered (strong mode = 1s)', () => {
    const rc = makeController();
    rc.configure({ lagBoostSec: 1, stepBoostFactor: 2 });
    rc.setSegments(makeSegments(20));
    const input = tickWith({ videoTime: 4, playing: playing(0, 0, 8) });
    expect(rc.tick(input)).toBeCloseTo(1.2);
  });

  it('keys the boost on the excess over allowance, not the raw lag', () => {
    const rc = makeController();
    rc.setSegments(makeSegments(20, 10, 6));
    const input = tickWith({ videoTime: 6, playing: playing(0, 0, 8) });
    expect(rc.tick(input)).toBeCloseTo(1.1);
  });

  it('keeps the normal step when the excess is below the threshold, even if the target is high', () => {
    const rc = makeController();
    rc.setSegments(makeSegments(2, 10, 8));
    rc.setMeasuredNaturalSec(1, 100);
    const input = tickWith({ videoDuration: 20, playing: playing(0, 0, 8) });
    expect(rc.tick(input)).toBeCloseTo(1.1);
  });

  it('never drops below baseRate even when audio runs ahead', () => {
    const rc = makeController();
    rc.setSegments(makeSegments(20));
    const input = tickWith({ videoTime: 3, playing: playing(0, 6, 8) });
    expect(rc.tick(input)).toBeCloseTo(1.0);
    expect(rc.tick(input)).toBeCloseTo(1.0);
    const behind = tickWith({ videoTime: 10, playing: playing(0, 0, 8) });
    for (let i = 0; i < 10; i++) rc.tick(behind);
    expect(rc.currentRate).toBeGreaterThan(1.5);
    for (let i = 0; i < 20; i++) rc.tick(input);
    expect(rc.currentRate).toBeCloseTo(1.0);
  });

  it('measures lag from queue head when nothing is playing yet', () => {
    const rc = makeController();
    rc.setSegments(makeSegments(20));
    const input = tickWith({ videoTime: 14, queued: [{ segIdx: 1, durationSec: 5 }] });
    expect(rc.tick(input)).toBeCloseTo(1.1);
    for (let i = 0; i < 15; i++) rc.tick(input);
    expect(rc.currentRate).toBeCloseTo(1.5);
  });

  it('end-of-lecture requirement dominates when measured audio exceeds remaining time', () => {
    const rc = makeController();
    rc.setSegments(makeSegments(2, 10, 8));
    rc.setMeasuredNaturalSec(1, 30);
    const input = tickWith({
      videoDuration: 20,
      playing: playing(0, 0, 8),
    });
    for (let i = 0; i < 15; i++) rc.tick(input);
    expect(rc.currentRate).toBeCloseTo(1.9);
  });

  it('targets maxRate when the end budget is exhausted', () => {
    const rc = makeController();
    rc.setSegments(makeSegments(2, 1, 1));
    const rate = rc.tick(
      tickWith({ videoTime: 1.95, videoDuration: 2, playing: playing(1, 0, 5) }),
    );
    expect(rate).toBeCloseTo(1.1);
  });

  it('caps extreme lag at maxRate', () => {
    const rc = new RateController({ baseRate: 1.0, step: 0.1, gain: 0.25, maxRate: 3.0 });
    rc.setSegments(makeSegments(20));
    const input = tickWith({ videoTime: 50, videoDuration: Infinity, playing: playing(0, 0, 8) });
    for (let i = 0; i < 30; i++) rc.tick(input);
    expect(rc.currentRate).toBeCloseTo(3.0);
  });

  it('drifts back to baseRate when idle (no clip, no queue)', () => {
    const rc = makeController();
    rc.setSegments(makeSegments(20));
    const behind = tickWith({ videoTime: 6, playing: playing(0, 0, 8) });
    for (let i = 0; i < 10; i++) rc.tick(behind);
    expect(rc.currentRate).toBeGreaterThan(1.5);
    const idle = tickWith({ videoTime: 6 });
    expect(rc.tick(idle)).toBeLessThan(rc.currentRate + 0.001);
    for (let i = 0; i < 20; i++) rc.tick(idle);
    expect(rc.currentRate).toBeCloseTo(1.0);
  });

  it('caps allowance so a huge silent gap does not delay acceleration', () => {
    const rc = new RateController({ baseRate: 1.0, step: 0.1, gain: 0.25, maxAllowance: 5 });
    rc.setSegments([
      { startTime: 0, endTime: 8 },
      { startTime: 108, endTime: 116 },
    ]);
    const input = tickWith({ videoTime: 11, videoDuration: Infinity, playing: playing(0, 0, 8) });
    for (let i = 0; i < 30; i++) rc.tick(input);
    expect(rc.currentRate).toBeGreaterThan(1.5);
  });

  it('handles Infinity videoDuration (no end requirement)', () => {
    const rc = makeController();
    rc.setSegments(makeSegments(3));
    const rate = rc.tick(
      tickWith({ videoTime: 1, videoDuration: Infinity, playing: playing(0, 1, 8) }),
    );
    expect(rate).toBeCloseTo(1.0);
  });

  it('reset snaps back to baseRate', () => {
    const rc = makeController();
    rc.setSegments(makeSegments(20));
    const input = tickWith({ videoTime: 10, playing: playing(0, 0, 8) });
    for (let i = 0; i < 5; i++) rc.tick(input);
    expect(rc.currentRate).toBeGreaterThan(1.0);
    rc.reset();
    expect(rc.currentRate).toBeCloseTo(1.0);
  });

  it('setBaseRate raises currentRate to the new floor', () => {
    const rc = makeController(1.0);
    rc.setBaseRate(1.5);
    expect(rc.currentRate).toBeCloseTo(1.5);
  });

  describe('feedForwardVideoRate', () => {
    const makeFf = (baseRate = 1.0) =>
      new RateController({ baseRate, step: 0.1, gain: 0.25, feedForwardVideoRate: true });

    it('multiplies the floor by the video rate', () => {
      const rc = makeFf();
      rc.setSegments(makeSegments(20));
      const rate = rc.tick(tickWith({ videoRate: 1.5, videoTime: 5, playing: playing(0, 4, 8) }));
      expect(rate).toBeCloseTo(1.5);
    });

    it('snaps up immediately when the video rate rises', () => {
      const rc = makeFf();
      rc.setSegments(makeSegments(20));
      expect(rc.tick(tickWith({ videoRate: 1, videoTime: 5, playing: playing(0, 4, 8) }))).toBeCloseTo(1.0);
      expect(rc.tick(tickWith({ videoRate: 2, videoTime: 5, playing: playing(0, 4, 8) }))).toBeCloseTo(2.0);
    });

    it('allows dropping below baseRate for slow video (sync, not deceleration)', () => {
      const rc = makeFf();
      rc.setSegments(makeSegments(20));
      const input = tickWith({ videoRate: 0.75, videoTime: 5, playing: playing(0, 4, 8) });
      for (let i = 0; i < 5; i++) rc.tick(input);
      expect(rc.currentRate).toBeCloseTo(0.75);
    });

    it('is disabled by default: floor ignores the video rate', () => {
      const rc = makeController();
      rc.setSegments(makeSegments(20));
      const rate = rc.tick(tickWith({ videoRate: 1.5, videoTime: 5, playing: playing(0, 4, 8) }));
      expect(rate).toBeCloseTo(1.0);
    });
  });
});
