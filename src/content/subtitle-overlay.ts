import { createLogger } from '../lib/logger';
import {
  fontSizeToPx,
  overlayStyleToCss,
  pxToRatio,
  ratioToPx,
  type Ratio,
} from '../lib/subtitle';
import type { SubtitleStyle } from '../lib/types';

const log = createLogger('subtitle-overlay');

const OVERLAY_ID = 'udemy-tts-subtitle-overlay';

export interface SubtitleOverlayOptions {
  style: SubtitleStyle;
  position: Ratio | null;
  onPositionChange: (r: Ratio) => void;
}

/* 字幕テキストをビデオ領域上に描画する。ドラッグで移動でき、位置は比率で保持してリサイズ時に再計算する */
export class SubtitleOverlay {
  private style: SubtitleStyle;
  private position: Ratio | null;
  private readonly onPositionChange: (r: Ratio) => void;

  private container: HTMLElement | null = null;
  private root: HTMLDivElement | null = null;
  private textEl: HTMLDivElement | null = null;

  private currentText: string | null = null;

  private drag: {
    pointerId: number;
    startX: number;
    startY: number;
    originCenterX: number;
    originBottomY: number;
  } | null = null;

  private readonly onPointerDown = (e: PointerEvent) => this.handlePointerDown(e);
  private readonly onPointerMove = (e: PointerEvent) => this.handlePointerMove(e);
  private readonly onPointerUp = (e: PointerEvent) => this.handlePointerUp(e);
  private readonly onFullscreenChange = () => this.applyPosition();

  constructor(opts: SubtitleOverlayOptions) {
    this.style = opts.style;
    this.position = opts.position;
    this.onPositionChange = opts.onPositionChange;
  }

  mount(): void {
    if (this.root) return;

    const container =
      document.querySelector<HTMLElement>('[class*="video-viewer--container"]') ??
      document.querySelector<HTMLVideoElement>('video')?.parentElement ??
      null;
    if (!container) {
      log.warn('no mount point found for subtitle overlay');
      return;
    }
    if (getComputedStyle(container).position === 'static') {
      container.style.position = 'relative';
    }
    this.container = container;

    const root = document.createElement('div');
    root.id = OVERLAY_ID;
    root.style.position = 'absolute';
    root.style.left = '0';
    root.style.top = '0';
    root.style.width = '100%';
    root.style.height = '100%';
    root.style.zIndex = '1';
    // ルートはビデオ操作を邪魔しないよう透過し、テキスト要素だけ掴めるようにする
    root.style.pointerEvents = 'none';
    root.hidden = true;

    const textEl = document.createElement('div');
    textEl.style.position = 'absolute';
    textEl.style.pointerEvents = 'auto';
    textEl.style.boxSizing = 'border-box';
    textEl.style.maxWidth = '80%';
    textEl.style.padding = '0.2em 0.6em';
    textEl.style.borderRadius = '0.3rem';
    textEl.style.textAlign = 'center';
    textEl.style.whiteSpace = 'pre-wrap';
    textEl.style.wordBreak = 'break-word';
    textEl.style.lineHeight = '1.3';
    textEl.style.cursor = 'move';
    textEl.style.userSelect = 'none';

    root.appendChild(textEl);
    container.appendChild(root);

    this.root = root;
    this.textEl = textEl;

    textEl.addEventListener('pointerdown', this.onPointerDown);
    textEl.addEventListener('pointermove', this.onPointerMove);
    textEl.addEventListener('pointerup', this.onPointerUp);
    document.addEventListener('fullscreenchange', this.onFullscreenChange);

    this.applyStyle();
    this.applyPosition();
    log.info('subtitle overlay mounted');
  }

  setText(text: string | null): void {
    this.currentText = text;
    if (!this.root || !this.textEl) return;
    try {
      if (text === null) {
        this.root.hidden = true;
        this.textEl.textContent = '';
      } else {
        this.textEl.textContent = text;
        this.root.hidden = false;
        if (!this.drag) this.applyPosition();
      }
    } catch (e) {
      log.warn('setText failed:', e);
    }
  }

  setStyle(style: SubtitleStyle): void {
    this.style = style;
    this.applyStyle();
  }

  setPosition(position: Ratio | null): void {
    this.position = position;
    this.applyPosition();
  }

  destroy(): void {
    try {
      if (this.textEl) {
        this.textEl.removeEventListener('pointerdown', this.onPointerDown);
        this.textEl.removeEventListener('pointermove', this.onPointerMove);
        this.textEl.removeEventListener('pointerup', this.onPointerUp);
      }
      document.removeEventListener('fullscreenchange', this.onFullscreenChange);
      this.root?.remove();
    } catch (e) {
      log.warn('destroy failed:', e);
    }
    this.drag = null;
    this.root = null;
    this.textEl = null;
    this.container = null;
    this.currentText = null;
  }

  private handlePointerDown(e: PointerEvent): void {
    if (!this.textEl || !this.container) return;
    try {
      const elRect = this.textEl.getBoundingClientRect();
      const containerRect = this.container.getBoundingClientRect();
      this.drag = {
        pointerId: e.pointerId,
        startX: e.clientX,
        startY: e.clientY,
        originCenterX: elRect.left - containerRect.left + elRect.width / 2,
        originBottomY: elRect.top - containerRect.top + elRect.height,
      };
      this.moveTo(this.drag.originCenterX, this.drag.originBottomY);
      this.textEl.setPointerCapture?.(e.pointerId);
      e.preventDefault();
    } catch (err) {
      log.warn('pointerdown failed:', err);
      this.drag = null;
    }
  }

  private handlePointerMove(e: PointerEvent): void {
    if (!this.drag || !this.textEl) return;
    if (e.pointerId !== this.drag.pointerId) return;
    try {
      const dx = e.clientX - this.drag.startX;
      const dy = e.clientY - this.drag.startY;
      this.moveTo(this.drag.originCenterX + dx, this.drag.originBottomY + dy);
      e.preventDefault();
    } catch (err) {
      log.warn('pointermove failed:', err);
    }
  }

  private handlePointerUp(e: PointerEvent): void {
    if (!this.drag || !this.textEl || !this.container) {
      this.drag = null;
      return;
    }
    if (e.pointerId !== this.drag.pointerId) return;
    try {
      this.textEl.releasePointerCapture?.(e.pointerId);
      const dx = e.clientX - this.drag.startX;
      const dy = e.clientY - this.drag.startY;
      const rect = this.container.getBoundingClientRect();
      const placeX = this.clampCenterX(this.drag.originCenterX + dx, rect.width);
      const placeY = Math.max(0, Math.min(rect.height, this.drag.originBottomY + dy));
      const ratio = pxToRatio(placeX, placeY, rect.width, rect.height);
      this.position = ratio;
      this.onPositionChange(ratio);
    } catch (err) {
      log.warn('pointerup failed:', err);
    } finally {
      this.drag = null;
    }
  }

  private applyStyle(): void {
    if (!this.textEl) return;
    try {
      const css = overlayStyleToCss(this.style);
      for (const [prop, value] of Object.entries(css)) {
        this.textEl.style.setProperty(prop, value);
      }
      this.refreshFontSize();
    } catch (e) {
      log.warn('applyStyle failed:', e);
    }
  }

  private refreshFontSize(): void {
    if (!this.textEl) return;
    const rect = this.container?.getBoundingClientRect();
    const px = fontSizeToPx(this.style.fontSize, rect?.height ?? 0);
    this.textEl.style.fontSize = `${px}px`;
  }

  private clampCenterX(cx: number, width: number): number {
    const margin = 2 * this.style.fontSize;
    if (width <= margin * 2) return width / 2;
    return Math.max(margin, Math.min(width - margin, cx));
  }

  private moveTo(cx: number, by: number): void {
    if (!this.textEl) return;
    const el = this.textEl;
    let placeX = cx;
    const rect = this.container?.getBoundingClientRect();
    if (rect && rect.width > 0) {
      placeX = this.clampCenterX(cx, rect.width);
      // 中心を保ったまま画面内に収まるよう、最大幅を左右対称にとる
      const symmetric = 2 * Math.min(placeX, rect.width - placeX);
      const maxW = Math.min(rect.width * 0.9, symmetric);
      el.style.maxWidth = `${Math.round(maxW)}px`;
    }
    el.style.left = '0';
    el.style.top = '0';
    el.style.bottom = '';
    // 下端中央を基準点にし、テキストが増えても上へ伸ばす
    el.style.transform = `translate(${placeX}px, ${by}px) translate(-50%, -100%)`;
  }

  private applyPosition(): void {
    if (!this.textEl) return;
    try {
      this.refreshFontSize();
      const el = this.textEl;
      const rect = this.container?.getBoundingClientRect();

      if (this.position !== null && rect) {
        const { x, y } = ratioToPx(this.position, rect.width, rect.height);
        this.moveTo(x, y);
        return;
      }
      if (rect && rect.width > 0 && rect.height > 0) {
        this.moveTo(rect.width / 2, rect.height * 0.92);
        return;
      }
      el.style.left = '50%';
      el.style.top = '';
      el.style.bottom = '8%';
      el.style.transform = 'translateX(-50%)';
    } catch (e) {
      log.warn('applyPosition failed:', e);
    }
  }
}
