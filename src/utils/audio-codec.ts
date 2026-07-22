// Chrome の拡張メッセージは ArrayBuffer を壊すため、音声を base64 と相互変換して受け渡す

export function base64ToArrayBuffer(base64: string): ArrayBuffer {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes.buffer;
}

export function arrayBufferToBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let binary = '';
  for (let i = 0; i < bytes.length; i += 0x8000) {
    binary += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  }
  return btoa(binary);
}

export function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = reader.result as string;
      resolve(dataUrl.slice(dataUrl.indexOf(',') + 1));
    };
    reader.onerror = () => reject(reader.error ?? new Error('FileReader failed'));
    reader.readAsDataURL(blob);
  });
}

export function audioToBytes(audio: ArrayBuffer | string): Uint8Array<ArrayBuffer> {
  return new Uint8Array(typeof audio === 'string' ? base64ToArrayBuffer(audio) : audio);
}

export function bytesToAudioBlob(bytes: Uint8Array<ArrayBuffer>): Blob {
  const isWav =
    bytes.length >= 4 &&
    bytes[0] === 0x52 &&
    bytes[1] === 0x49 &&
    bytes[2] === 0x46 &&
    bytes[3] === 0x46;
  return new Blob([bytes], { type: isWav ? 'audio/wav' : 'audio/mpeg' });
}

export function audioToBlob(audio: ArrayBuffer | string): Blob {
  return bytesToAudioBlob(audioToBytes(audio));
}
