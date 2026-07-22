import { i18n } from '#i18n';
import { createLogger } from '../lib/logger';
import type { CacheListResponse, ExtensionSettings } from '../lib/types';
import { sendMessage } from '../utils/messaging';
import type { LectureSession } from './session';

// Udemy のプレイヤーにコントロールを差し込む。
// 見た目は Udemy の実 DOM と CSS を流用し、独自装飾は最小限にする。

const log = createLogger('widget');

const WIDGET_ID = 'udemy-tts-widget';
const STYLE_ID = 'udemy-tts-styles';
const TOOLTIP_ID = 'udemy-tts-tooltip';

const ICON_CANDIDATES = ['icon-audio', 'icon-sound', 'icon-headphones', 'icon-speaker', 'icon-volume-on'];

export interface WidgetOptions {
  session: LectureSession;
  persist: (patch: Partial<ExtensionSettings>) => void;
  restart: () => void;
}

export function mountWidget(opts: WidgetOptions): void {
  document.getElementById(WIDGET_ID)?.remove();
  injectStyles();

  const controlBar = document.querySelector<HTMLElement>('[data-purpose="video-controls"]');

  const wrapper = document.createElement('div');
  wrapper.id = WIDGET_ID;
  wrapper.className = 'utts-wrapper';

  const button = createButton(controlBar, opts.session);
  const tooltip = createButtonTooltip(i18n.t('widget.title'));
  const panel = createPanel(opts);
  wrapper.append(button, tooltip, panel.el);

  button.addEventListener('click', () => {
    panel.el.hidden = !panel.el.hidden;
    tooltip.hidden = true;
    if (!panel.el.hidden) panel.sync();
  });
  button.addEventListener('mouseenter', () => {
    if (panel.el.hidden) tooltip.hidden = false;
  });
  button.addEventListener('mouseleave', () => {
    tooltip.hidden = true;
  });
  document.addEventListener(
    'click',
    (e) => {
      if (!wrapper.contains(e.target as Node)) panel.el.hidden = true;
    },
    true,
  );

  if (controlBar) {
    // 音量ボタンの左隣に差し込む。音量スライダーの透明なホバー領域がボタンを覆うため、ラッパーは z-index で上に重ねている
    const spacer = controlBar.querySelector('[class*="shaka-control-bar-module--spacer"]');
    if (spacer) spacer.after(wrapper);
    else controlBar.appendChild(wrapper);
    log.info('widget mounted in Udemy control bar');
    return;
  }

  const container =
    document.querySelector<HTMLElement>('[class*="video-viewer--container"]') ??
    document.querySelector<HTMLVideoElement>('video')?.parentElement ??
    null;
  if (!container) {
    log.warn('no mount point found for widget');
    return;
  }
  if (getComputedStyle(container).position === 'static') container.style.position = 'relative';
  wrapper.classList.add('utts-floating');
  container.appendChild(wrapper);
  log.info('widget mounted as floating fallback');
}

export function unmountWidget(): void {
  document.getElementById(WIDGET_ID)?.remove();
  document.getElementById(TOOLTIP_ID)?.remove();
}

/** Udemy の実ボタンのクラスとアイコンを複製して作る。取得できないときだけ独自スタイルで代替する */
function createButton(controlBar: HTMLElement | null, session: LectureSession): HTMLButtonElement {
  const btn = document.createElement('button');
  btn.type = 'button';
  btn.setAttribute('aria-label', i18n.t('widget.title'));
  btn.setAttribute('data-purpose', 'udemy-tts-button');

  const template = controlBar?.querySelector<HTMLButtonElement>(
    '[data-purpose="settings-button"], [data-purpose="captions-dropdown-button"]',
  );
  btn.className = `${template?.className ?? 'ud-btn ud-btn-medium ud-btn-ghost ud-btn-text-sm'} utts-btn`;

  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  const templateSvg = template?.querySelector('svg');
  svg.setAttribute('class', templateSvg?.getAttribute('class') ?? 'ud-icon ud-icon-medium');
  svg.setAttribute('role', 'img');
  svg.setAttribute('focusable', 'false');
  svg.setAttribute('aria-hidden', 'true');

  const spriteId = ICON_CANDIDATES.find((id) => document.getElementById(id));
  if (spriteId) {
    const use = document.createElementNS('http://www.w3.org/2000/svg', 'use');
    use.setAttribute('href', `#${spriteId}`);
    use.setAttributeNS('http://www.w3.org/1999/xlink', 'xlink:href', `#${spriteId}`);
    svg.appendChild(use);
  } else {
    svg.setAttribute('viewBox', '0 0 24 24');
    svg.setAttribute('fill', 'currentColor');
    svg.classList.add('utts-icon-fallback');
    const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    path.setAttribute(
      'd',
      'M3 9v6h4l5 5V4L7 9H3zm13.5 3c0-1.77-1.02-3.29-2.5-4.03v8.05c1.48-.73 2.5-2.25 2.5-4.02zM14 3.23v2.06c2.89.86 5 3.54 5 6.71s-2.11 5.85-5 6.71v2.06c4.01-.91 7-4.49 7-8.77s-2.99-7.86-7-8.77z',
    );
    svg.appendChild(path);
  }

  const dot = document.createElement('span');
  dot.className = 'utts-dot';
  dot.classList.toggle('off', !session.enabled);

  btn.append(svg, dot);
  return btn;
}

function createPanel(opts: WidgetOptions) {
  const { session, persist, restart } = opts;

  const panel = document.createElement('div');
  panel.className = 'utts-panel utts-menu-outer';
  panel.hidden = true;

  const inner = document.createElement('div');
  inner.className = 'utts-menu';
  panel.appendChild(inner);

  const body = document.createElement('div');
  body.className = 'utts-menu-body';

  function makeToggleItem(
    label: string,
    initial: boolean,
    onChange: (on: boolean) => void,
    parent: HTMLElement = body,
  ) {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'utts-item';
    btn.setAttribute('role', 'menuitemcheckbox');
    let state = initial;
    btn.setAttribute('aria-checked', String(state));
    btn.appendChild(document.createTextNode(label));
    const slider = document.createElement('span');
    slider.className = 'utts-checkbox-slider';
    btn.appendChild(slider);
    btn.addEventListener('click', () => {
      if (btn.classList.contains('utts-item-disabled')) return;
      state = !state;
      btn.setAttribute('aria-checked', String(state));
      onChange(state);
    });
    parent.appendChild(btn);
    return {
      el: btn,
      set(v: boolean) {
        state = v;
        btn.setAttribute('aria-checked', String(state));
      },
    };
  }

  function makeSliderRow(
    label: string,
    range: { min: number; max: number; step: number },
    initial: number,
    display: (v: number) => string,
    onInput: (v: number) => void,
  ) {
    const row = document.createElement('div');
    row.className = 'utts-item utts-static-row';
    const lbl = document.createElement('span');
    lbl.className = 'utts-row-label';
    lbl.textContent = label;
    const val = document.createElement('span');
    val.className = 'utts-val';
    val.textContent = display(initial);
    const input = document.createElement('input');
    input.type = 'range';
    input.className = 'utts-range';
    input.min = String(range.min);
    input.max = String(range.max);
    input.step = String(range.step);
    input.value = String(initial);
    input.addEventListener('input', () => {
      const v = parseFloat(input.value);
      val.textContent = display(v);
      onInput(v);
    });
    row.append(lbl, val, input);
    body.appendChild(row);
    return {
      set(v: number) {
        input.value = String(v);
        val.textContent = display(v);
      },
    };
  }

  function makeSeparator(parent: HTMLElement = body) {
    const sep = document.createElement('li');
    sep.setAttribute('role', 'separator');
    sep.className = 'utts-separator';
    parent.appendChild(sep);
  }

  function setBodyDisabled(disabled: boolean): void {
    body.classList.toggle('utts-disabled', disabled);
  }

  const masterToggle = makeToggleItem(
    i18n.t('widget.master'),
    session.enabled,
    (on) => {
      session.setEnabled(on);
      persist({ enabled: on });
      document.querySelector(`#${WIDGET_ID} .utts-dot`)?.classList.toggle('off', !on);
      setBodyDisabled(!on);
    },
    inner,
  );
  makeSeparator(inner);
  inner.appendChild(body);
  setBodyDisabled(!session.enabled);

  const ttsToggle = makeToggleItem(i18n.t('widget.enable'), session.ttsEnabled, (on) => {
    session.setTtsEnabled(on);
    persist({ ttsEnabled: on });
  });
  const auto = makeToggleItem(i18n.t('widget.autoSpeed'), session.autoRateAdjust, (on) => {
    session.setAutoRate(on);
    persist({ autoRateAdjust: on });
  });
  const translate = makeToggleItem(i18n.t('widget.translate'), session.translateEnabled, (on) =>
    persist({ translateEnabled: on }),
  );
  if (!session.hasApiKey()) {
    translate.el.classList.add('utts-item-disabled');
    translate.el.setAttribute('aria-disabled', 'true');
    attachTooltip(translate.el, i18n.t('widget.translateNoKey'));
  }
  const overlayToggle = makeToggleItem(
    i18n.t('widget.subtitleOverlay'),
    session.subtitleEnabled,
    (on) => {
      session.setSubtitleEnabled(on);
      persist({ subtitleOverlayEnabled: on });
    },
  );

  makeSeparator();

  const volume = makeSliderRow(
    i18n.t('widget.volume'),
    { min: 0, max: 100, step: 1 },
    Math.round(session.volume * 100),
    (v) => String(Math.round(v)),
    (v) => {
      session.setVolume(v / 100);
      persist({ ttsVolume: v / 100 });
    },
  );
  const rate = makeSliderRow(
    i18n.t('widget.speed'),
    { min: 0.5, max: 2.0, step: 0.1 },
    session.controller.getBaseRate(),
    (v) => v.toFixed(1),
    (v) => {
      session.setBaseRate(v);
      persist({ ttsRate: v });
    },
  );

  makeSeparator();

  const cacheBtn = document.createElement('button');
  cacheBtn.type = 'button';
  cacheBtn.className = 'utts-item';
  cacheBtn.appendChild(document.createTextNode(i18n.t('widget.cacheClear')));
  const cacheVal = document.createElement('span');
  cacheVal.className = 'utts-val';
  cacheVal.textContent = '…';
  cacheBtn.appendChild(cacheVal);
  cacheBtn.disabled = true;
  body.appendChild(cacheBtn);

  let cacheKeys: string[] = [];
  async function refreshCache(): Promise<void> {
    try {
      const res = await sendMessage<CacheListResponse>({
        type: 'CACHE_STATUS',
        courseId: session.courseId,
        lectureId: session.lectureId,
      });
      cacheKeys = res.entries.map((e) => e.key);
      if (res.entries.length === 0) {
        cacheVal.textContent = i18n.t('widget.cacheNone');
        cacheBtn.disabled = true;
      } else {
        const bytes = res.entries.reduce((sum, e) => sum + e.byteSize, 0);
        cacheVal.textContent =
          bytes < 1024 * 1024
            ? `${(bytes / 1024).toFixed(1)} KB`
            : `${(bytes / 1024 / 1024).toFixed(2)} MB`;
        cacheBtn.disabled = false;
      }
    } catch (e) {
      log.warn('cache status failed:', e);
      cacheVal.textContent = '—';
    }
  }
  cacheBtn.addEventListener('click', () => {
    void (async () => {
      if (cacheKeys.length === 0) return;
      await sendMessage({ type: 'CACHE_DELETE', keys: cacheKeys });
      // 削除だけではメモリ上の訳や合成済み音声が残るため、セッションを作り直してその場で再翻訳させる
      restart();
    })();
  });

  makeSeparator();

  const settingsBtn = document.createElement('button');
  settingsBtn.type = 'button';
  settingsBtn.className = 'utts-item';
  settingsBtn.textContent = i18n.t('widget.settings');
  settingsBtn.addEventListener('click', () => {
    void sendMessage({ type: 'OPEN_OPTIONS' });
    panel.hidden = true;
  });
  body.appendChild(settingsBtn);

  const sync = () => {
    masterToggle.set(session.enabled);
    setBodyDisabled(!session.enabled);
    ttsToggle.set(session.ttsEnabled);
    volume.set(Math.round(session.volume * 100));
    rate.set(session.controller.getBaseRate());
    auto.set(session.autoRateAdjust);
    translate.set(session.translateEnabled);
    overlayToggle.set(session.subtitleEnabled);
    void refreshCache();
  };

  return { el: panel, sync };
}

function createButtonTooltip(text: string): HTMLElement {
  const tip = document.createElement('div');
  tip.className = 'utts-tooltip';
  tip.setAttribute('role', 'tooltip');
  tip.textContent = text;
  tip.hidden = true;
  return tip;
}

function attachTooltip(target: HTMLElement, text: string): void {
  const margin = 8;
  const move = (e: MouseEvent) => {
    const tip = getTooltipEl();
    tip.textContent = text;
    tip.hidden = false;
    let left = e.clientX + 12;
    let top = e.clientY - tip.offsetHeight - 12;
    const maxLeft = window.innerWidth - tip.offsetWidth - margin;
    if (left > maxLeft) left = Math.max(margin, maxLeft);
    if (top < margin) top = e.clientY + 16;
    tip.style.left = `${left}px`;
    tip.style.top = `${top}px`;
  };
  target.addEventListener('mouseenter', move);
  target.addEventListener('mousemove', move);
  target.addEventListener('mouseleave', () => {
    getTooltipEl().hidden = true;
  });
}

function getTooltipEl(): HTMLElement {
  let el = document.getElementById(TOOLTIP_ID);
  if (!el) {
    el = document.createElement('div');
    el.id = TOOLTIP_ID;
    el.className = 'utts-cursor-tooltip';
    el.hidden = true;
    document.body.appendChild(el);
  }
  return el;
}

// パネルの見た目は Udemy 配信の実 CSS ルールをそのまま使い、クラス名だけ utts-* に付け替えている。
// ハッシュ付きのモジュールクラスはデプロイで変わるため借用しない。
function injectStyles(): void {
  if (document.getElementById(STYLE_ID)) return;
  const style = document.createElement('style');
  style.id = STYLE_ID;
  style.textContent = `
    .utts-wrapper { position: relative; z-index: 1; display: inline-flex; align-items: center; flex-shrink: 0; }
    .utts-btn { position: relative; }
    .utts-icon-fallback { width: 2.4rem; height: 2.4rem; }
    .utts-dot {
      position: absolute; top: 0.4rem; inset-inline-end: 0.2rem;
      width: 0.6rem; height: 0.6rem; border-radius: 50%;
      background: #4ade80; transition: background 0.2s; pointer-events: none;
    }
    .utts-dot.off { background: #6a6f73; }
    .utts-panel {
      position: absolute; bottom: calc(100% + 3.2rem); inset-inline-end: 0;
      z-index: 10000; text-align: start;
    }
    .utts-panel[hidden] { display: none !important; }
    .utts-tooltip {
      position: absolute; inset-block-end: calc(100% + 0.6rem); inset-inline-start: 50%;
      transform: translateX(-50%); z-index: 1030;
      padding: 0.8rem; background: rgb(28, 29, 31);
      border: 1px solid oklch(0.4809 0.0371 279.08); border-radius: 0.4rem;
      color: rgb(255, 255, 255); font-size: 1.4rem; font-weight: 400; line-height: 1.6;
      white-space: nowrap; pointer-events: none;
    }
    .utts-tooltip[hidden] { display: none !important; }
    .utts-cursor-tooltip {
      position: fixed; z-index: 2147483647;
      background: rgb(28, 29, 31); border: 1px solid oklch(0.4809 0.0371 279.08);
      padding: 0.6rem 1rem;
      font-size: 1.3rem; font-weight: 400; line-height: 1.4; color: #fff;
      white-space: normal; width: max-content; max-width: 30rem; text-align: start;
      box-shadow: 0 4px 16px rgba(0, 0, 0, 0.5);
      pointer-events: none;
    }
    .utts-cursor-tooltip[hidden] { display: none !important; }
    .utts-item-disabled { opacity: 0.5; cursor: not-allowed; }
    .utts-menu-body { display: flex; flex-direction: column; }
    .utts-menu-body.utts-disabled { opacity: 0.4; pointer-events: none; }
    .utts-static-row { cursor: default; justify-content: flex-start; }
    .utts-static-row:hover { background-color: transparent; }
    .utts-row-label { flex-shrink: 0; }
    .utts-val {
      text-align: end; font-variant-numeric: tabular-nums; flex-shrink: 0;
      min-inline-size: 3.2rem;
    }
    .utts-range { flex: 1 1 auto; min-inline-size: 9rem; accent-color: #a435f0; cursor: pointer; }
    .utts-menu-outer { background: rgb(28, 29, 31); border: 1px solid oklch(0.4809 0.0371 279.08); min-inline-size: 16rem; box-shadow: color-mix(in oklch, oklch(0.6295 0.0204 306.5) 8%, transparent) 0px 2px 8px 0px, color-mix(in oklch, oklch(0.6295 0.0204 306.5) 12%, transparent) 0px 4px 16px 0px; color: rgb(255, 255, 255); display: flex; flex-direction: column; overflow: hidden; }
    .utts-menu-outer > * { display: block; inline-size: 100%; }
    .utts-menu-outer li[role="separator"] { border-block-start: 1px solid oklch(0.4809 0.0371 279.08); margin-block: 0.8rem; margin-inline: 0px; block-size: 0px; padding: 0px; list-style: none; }
    .utts-menu { background: transparent; padding-block: 0.8rem; padding-inline: 0px; min-inline-size: 16rem; display: flex; flex-direction: column; }
    .utts-item { background: transparent; border: medium; color: rgb(255, 255, 255); cursor: pointer; padding-block: 0.8rem; padding-inline: 3.2rem; inline-size: 100%; text-align: start; font-size: 1.4rem; font-weight: 300; line-height: 1.6; transition: background-color 0.2s; display: flex; align-items: center; justify-content: space-between; gap: 0.8rem; white-space: nowrap; }
    .utts-item > div { display: flex; align-items: center; }
    .utts-item:hover { background-color: oklch(0.4809 0.0371 279.08); }
    .utts-item:disabled { opacity: 0.5; cursor: not-allowed; }
    .utts-checkbox-slider { background: oklch(0.6722 0.0355 279.77); border: 1px solid var(--applied-border-default, oklch(0.4809 0.0371 279.08)); border-radius: 100rem; box-sizing: content-box; display: inline-block; flex-shrink: 0; inline-size: 3.8rem; block-size: 1.4rem; position: relative; }
    .utts-checkbox-slider::after { background: rgb(255, 255, 255); border-radius: 100rem; content: ""; display: inline-block; position: absolute; inset-block-start: 0px; inset-inline-start: 0px; inline-size: 1.4rem; block-size: 1.4rem; transition: transform 250ms cubic-bezier(0.2, 0, 0.38, 0.9); }
    [aria-checked="true"] .utts-checkbox-slider { background: rgb(28, 29, 31); }
    [aria-checked="true"] .utts-checkbox-slider::after { transform: translateX(2.4rem); }
    .utts-wrapper.utts-floating {
      position: absolute; bottom: 7.2rem; inset-inline-end: 1rem; z-index: 9999;
    }
    .utts-wrapper.utts-floating .utts-btn {
      background: rgba(20, 20, 20, 0.88); border: 1px solid rgba(255,255,255,0.14);
      border-radius: 0.6rem; color: #fff; padding: 0.6rem;
    }
  `;
  document.head.appendChild(style);
}
