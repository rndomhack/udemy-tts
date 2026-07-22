import { describe, expect, it } from 'vitest';
import { audioDurationSec, mp3DurationSec, wavDurationSec } from './audio-duration';

// 24kHz 16bit モノラル (byteRate 48000) の WAV を合成する
function buildWav(dataSize: number, byteRate = 48000): Uint8Array {
  const bytes = new Uint8Array(44 + dataSize);
  const view = new DataView(bytes.buffer);
  const write = (offset: number, text: string) => {
    for (let i = 0; i < text.length; i++) bytes[offset + i] = text.charCodeAt(i);
  };
  write(0, 'RIFF');
  view.setUint32(4, 36 + dataSize, true);
  write(8, 'WAVE');
  write(12, 'fmt ');
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, 1, true);
  view.setUint32(24, 24000, true);
  view.setUint32(28, byteRate, true);
  view.setUint16(32, 2, true);
  view.setUint16(34, 16, true);
  write(36, 'data');
  view.setUint32(40, dataSize, true);
  return bytes;
}

// MPEG-2 Layer III 48kbps 24kHz のフレームヘッダーで始まる MP3 を合成する
function buildMp3(totalSize: number): Uint8Array {
  const bytes = new Uint8Array(totalSize);
  bytes[0] = 0xff;
  bytes[1] = 0xf3;
  bytes[2] = 0x64;
  bytes[3] = 0x00;
  return bytes;
}

describe('wavDurationSec', () => {
  it('computes duration from byteRate and data size', () => {
    expect(wavDurationSec(buildWav(96000))).toBeCloseTo(2.0);
  });

  it('returns null for non-WAV bytes', () => {
    expect(wavDurationSec(buildMp3(1000))).toBeNull();
  });
});

describe('mp3DurationSec', () => {
  it('computes duration from the CBR frame header', () => {
    // 48kbps = 6000 B/s
    expect(mp3DurationSec(buildMp3(12000))).toBeCloseTo(2.0);
  });

  it('skips a leading ID3v2 tag', () => {
    const body = buildMp3(6000);
    const bytes = new Uint8Array(10 + 128 + body.length);
    bytes.set([0x49, 0x44, 0x33, 4, 0, 0, 0, 0, 1, 0]); // "ID3", サイズ 128 (synchsafe)
    bytes.set(body, 10 + 128);
    expect(mp3DurationSec(bytes)).toBeCloseTo(1.0);
  });

  it('returns null when no frame header is found', () => {
    expect(mp3DurationSec(new Uint8Array(100))).toBeNull();
  });
});

describe('audioDurationSec', () => {
  it('dispatches by container signature', () => {
    expect(audioDurationSec(buildWav(48000))).toBeCloseTo(1.0);
    expect(audioDurationSec(buildMp3(6000))).toBeCloseTo(1.0);
  });
});
