<script lang="ts">
  import { i18n } from '#i18n';
  import type { SubtitleStyle } from '../../lib/types';
  import { settings, updateSettings } from '../stores';

  function hexToRgb(hex: string): { r: number; g: number; b: number } {
    const m = /^#?([0-9a-f]{6})$/i.exec(hex.trim());
    if (!m) return { r: 0, g: 0, b: 0 };
    const n = parseInt(m[1], 16);
    return { r: (n >> 16) & 0xff, g: (n >> 8) & 0xff, b: n & 0xff };
  }

  function rgbToHex(r: number, g: number, b: number): string {
    const h = (v: number) => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, '0');
    return `#${h(r)}${h(g)}${h(b)}`;
  }

  function parseRgba(color: string): { r: number; g: number; b: number; a: number } {
    const m = /rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)\s*(?:,\s*([\d.]+)\s*)?\)/i.exec(color);
    if (!m) return { r: 0, g: 0, b: 0, a: 0.75 };
    return {
      r: Number(m[1]),
      g: Number(m[2]),
      b: Number(m[3]),
      a: m[4] === undefined ? 1 : Number(m[4]),
    };
  }

  function composeRgba(hex: string, alpha: number): string {
    const { r, g, b } = hexToRgb(hex);
    return `rgba(${r}, ${g}, ${b}, ${alpha})`;
  }

  function patchStyle(patch: Partial<SubtitleStyle>): void {
    const current = $settings!.subtitleStyle;
    updateSettings({ subtitleStyle: { ...current, ...patch } });
  }

  const bg = $derived(parseRgba($settings?.subtitleStyle.backgroundColor ?? ''));
  const bgHex = $derived(rgbToHex(bg.r, bg.g, bg.b));
</script>

{#if $settings}
  <section>
    <h2>{i18n.t('options.subtitle.heading')}</h2>

    <label class="field checkbox">
      <input
        type="checkbox"
        checked={$settings.subtitleOverlayEnabled}
        onchange={(e) => updateSettings({ subtitleOverlayEnabled: e.currentTarget.checked })}
      />
      <span>{i18n.t('options.subtitle.enabled')}</span>
    </label>

    <label class="field">
      <span>{i18n.t('options.subtitle.fontSize')}: {$settings.subtitleStyle.fontSize}</span>
      <input
        type="range"
        min="12"
        max="48"
        step="1"
        value={$settings.subtitleStyle.fontSize}
        oninput={(e) => patchStyle({ fontSize: parseInt(e.currentTarget.value, 10) })}
      />
    </label>

    <div class="field">
      <span>{i18n.t('options.subtitle.textColor')}</span>
      <input
        class="swatch"
        type="color"
        value={$settings.subtitleStyle.textColor}
        oninput={(e) => patchStyle({ textColor: e.currentTarget.value })}
      />
    </div>

    <div class="field">
      <span>{i18n.t('options.subtitle.backgroundColor')}: {Math.round(bg.a * 100)}%</span>
      <div class="bg-row">
        <input
          class="swatch"
          type="color"
          value={bgHex}
          oninput={(e) => patchStyle({ backgroundColor: composeRgba(e.currentTarget.value, bg.a) })}
        />
        <input
          class="opacity"
          type="range"
          min="0"
          max="1"
          step="0.01"
          value={bg.a}
          oninput={(e) =>
            patchStyle({ backgroundColor: composeRgba(bgHex, parseFloat(e.currentTarget.value)) })}
        />
      </div>
    </div>

    <div class="preview">
      <span class="preview-box" style:background={$settings.subtitleStyle.backgroundColor}>
        <span style:color={$settings.subtitleStyle.textColor}>Aa Bb 123 字幕</span>
      </span>
    </div>
  </section>
{/if}

<style>
  .swatch {
    width: 52px;
    height: 32px;
    padding: 2px;
    border: 1px solid var(--input-border);
    border-radius: 6px;
    background: var(--card);
    cursor: pointer;
    flex-shrink: 0;
  }
  .bg-row {
    display: flex;
    align-items: center;
    gap: 12px;
  }
  .bg-row .opacity {
    flex: 1;
    min-width: 0;
  }
  .preview {
    margin-top: 4px;
    padding: 16px 12px;
    border-radius: 6px;
    text-align: center;
    background-image:
      linear-gradient(45deg, var(--border) 25%, transparent 25%),
      linear-gradient(-45deg, var(--border) 25%, transparent 25%),
      linear-gradient(45deg, transparent 75%, var(--border) 75%),
      linear-gradient(-45deg, transparent 75%, var(--border) 75%);
    background-size: 16px 16px;
    background-position:
      0 0,
      0 8px,
      8px -8px,
      -8px 0;
  }
  .preview-box {
    display: inline-block;
    padding: 4px 10px;
    border-radius: 4px;
    font-size: 18px;
    font-weight: 600;
    line-height: 1.3;
  }
</style>
