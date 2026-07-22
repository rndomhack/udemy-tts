// 合成音声のバイト列からヘッダーを読み、音声の長さ (秒) を求める。
// WAV は fmt チャンクの byteRate、MP3 は先頭フレームのビットレート (CBR 前提) を使う。

export function audioDurationSec(bytes: Uint8Array): number | null {
  return isRiffWave(bytes) ? wavDurationSec(bytes) : mp3DurationSec(bytes);
}

function isRiffWave(bytes: Uint8Array): boolean {
  return bytes.length >= 12 && ascii(bytes, 0, 4) === 'RIFF' && ascii(bytes, 8, 4) === 'WAVE';
}

export function wavDurationSec(bytes: Uint8Array): number | null {
  if (!isRiffWave(bytes)) return null;
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  let byteRate = 0;
  let offset = 12;
  while (offset + 8 <= bytes.length) {
    const id = ascii(bytes, offset, 4);
    const size = view.getUint32(offset + 4, true);
    if (id === 'fmt ' && offset + 20 <= bytes.length) {
      byteRate = view.getUint32(offset + 16, true);
    } else if (id === 'data') {
      const dataSize = Math.min(size, bytes.length - offset - 8);
      return byteRate > 0 ? dataSize / byteRate : null;
    }
    offset += 8 + size + (size % 2);
  }
  return null;
}

// Layer III のビットレート表 (kbps)。インデックス 0 (free) と 15 (bad) は扱わない
const MP3_KBPS_V1 = [0, 32, 40, 48, 56, 64, 80, 96, 112, 128, 160, 192, 224, 256, 320];
const MP3_KBPS_V2 = [0, 8, 16, 24, 32, 40, 48, 56, 64, 80, 96, 112, 128, 144, 160];

export function mp3DurationSec(bytes: Uint8Array): number | null {
  let offset = 0;
  // ID3v2 タグがあれば読み飛ばす (サイズは synchsafe 表現)
  if (bytes.length > 10 && ascii(bytes, 0, 3) === 'ID3') {
    offset =
      10 +
      (((bytes[6] & 0x7f) << 21) |
        ((bytes[7] & 0x7f) << 14) |
        ((bytes[8] & 0x7f) << 7) |
        (bytes[9] & 0x7f));
  }
  const limit = Math.min(bytes.length - 4, offset + 4096);
  for (let i = offset; i <= limit; i++) {
    if (bytes[i] !== 0xff || (bytes[i + 1] & 0xe0) !== 0xe0) continue;
    const versionBits = (bytes[i + 1] >> 3) & 0x03;
    const layerBits = (bytes[i + 1] >> 1) & 0x03;
    const bitrateIdx = (bytes[i + 2] >> 4) & 0x0f;
    if (versionBits === 1 || layerBits !== 1 || bitrateIdx === 0 || bitrateIdx === 15) continue;
    const kbps = (versionBits === 3 ? MP3_KBPS_V1 : MP3_KBPS_V2)[bitrateIdx];
    return (bytes.length - i) / ((kbps * 1000) / 8);
  }
  return null;
}

function ascii(bytes: Uint8Array, offset: number, length: number): string {
  return String.fromCharCode(...bytes.subarray(offset, offset + length));
}
