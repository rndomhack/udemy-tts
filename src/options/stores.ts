import { get, writable } from 'svelte/store';
import type { ExtensionSettings, ProviderConfig, ProviderId } from '../lib/types';
import { getSettings, mergeSettings, settingsStorage } from '../utils/storage';

// オプションの設定を Svelte ストアと同期する。
// 書き込みは少し遅延させてまとめる。

export const settings = writable<ExtensionSettings | null>(null);

let saveTimer: ReturnType<typeof setTimeout> | null = null;

export async function initSettings(): Promise<void> {
  settings.set(await getSettings());
  settingsStorage.watch((v) => settings.set(mergeSettings(v)));
}

function scheduleSave(): void {
  if (saveTimer) clearTimeout(saveTimer);
  saveTimer = setTimeout(() => {
    const value = get(settings);
    if (value) void settingsStorage.setValue(value);
  }, 300);
}

export function updateSettings(patch: Partial<ExtensionSettings>): void {
  settings.update((s) => (s ? { ...s, ...patch } : s));
  scheduleSave();
}

export function updateProvider(id: ProviderId, patch: Partial<ProviderConfig>): void {
  settings.update((s) =>
    s
      ? {
          ...s,
          providers: { ...s.providers, [id]: { ...s.providers[id], ...patch } },
        }
      : s,
  );
  scheduleSave();
}
