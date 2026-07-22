// 再生速度・ピッチ・音量の数値を、Edge TTS が求める文字列形式へ変換する

// 1.0 → "+0%", 1.2 → "+20%", 0.8 → "-20%"
export function formatRate(rate: number): string {
  const pct = Math.round((rate - 1.0) * 100);
  return pct >= 0 ? `+${pct}%` : `${pct}%`;
}

// 1.0 → "+0Hz", 1.1 → "+10Hz"
export function formatPitch(pitch: number): string {
  const hz = Math.round((pitch - 1.0) * 100);
  return hz >= 0 ? `+${hz}Hz` : `${hz}Hz`;
}

// 1.0 → "+0%", 0.5 → "-50%"
export function formatVolume(volume: number): string {
  const pct = Math.round((volume - 1.0) * 100);
  return pct >= 0 ? `+${pct}%` : `${pct}%`;
}
