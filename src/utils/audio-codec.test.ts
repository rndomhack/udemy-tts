import { describe, expect, it } from 'vitest';
import { audioToBlob, base64ToArrayBuffer } from './audio-codec';

const bytes = new Uint8Array([0, 1, 2, 253, 254, 255]);
const base64 = btoa(String.fromCharCode(...bytes));

describe('base64ToArrayBuffer', () => {
  it('decodes base64 back to the original bytes (Chrome の音声受け渡し経路)', () => {
    expect(new Uint8Array(base64ToArrayBuffer(base64))).toEqual(bytes);
  });

  it('decodes empty input to an empty buffer', () => {
    expect(base64ToArrayBuffer('').byteLength).toBe(0);
  });
});

describe('audioToBlob', () => {
  it('wraps an ArrayBuffer as an audio/mpeg Blob (Firefox 経路)', async () => {
    const blob = audioToBlob(bytes.buffer);
    expect(blob.type).toBe('audio/mpeg');
    expect(new Uint8Array(await blob.arrayBuffer())).toEqual(bytes);
  });

  it('decodes a base64 string into the same bytes (Chrome 経路)', async () => {
    const blob = audioToBlob(base64);
    expect(blob.type).toBe('audio/mpeg');
    expect(new Uint8Array(await blob.arrayBuffer())).toEqual(bytes);
  });
});
