/**
 * @file Always-visible FPS meter — top-left corner.
 *
 * Requirements:
 * - Always rendered on top of all scenes (added to the app stage directly).
 * - Updates at a fixed interval (250ms) to reduce visual jitter.
 * - Pill-shaped HUD: semi-transparent dark background, colour-coded text.
 *   - Green  (≥50 fps): good performance
 *   - Yellow (30–49):   acceptable
 *   - Red    (<30):     performance warning
 */

import { Container, Graphics, Text, TextStyle } from 'pixi.js';
import type { Application, Ticker } from 'pixi.js';

/** How often the displayed FPS value is refreshed, in milliseconds. */
const FPS_UPDATE_INTERVAL_MS = 250;

/** Safe area margin from the canvas edge, in pixels. */
const MARGIN = 8;

const PILL_W = 110;
const PILL_H = 32;
const PILL_R = 6;

const COLOR_GOOD = 0x00ff88;
const COLOR_WARN = 0xffcc00;
const COLOR_BAD  = 0xff4444;

/**
 * Always-visible FPS display.
 *
 * Uses three pre-built label+pill pairs (good / warn / bad) and swaps visibility
 * instead of mutating TextStyle.fill — style mutation invalidates the text
 * texture cache and triggers a re-upload every colour change.
 */
export class FPSMeter {
  private readonly _app: Application;
  private readonly _container: Container;

  // One Graphics pill + one Text label per colour state.
  // Only one set is visible at a time.
  private readonly _pills: Graphics[]  = [];
  private readonly _labels: Text[]     = [];
  private _activeIdx = 0;

  private _elapsed = 0;

  /** Bound ticker callback kept for clean removal. */
  private readonly _onTick: (ticker: Ticker) => void;

  public constructor(app: Application) {
    this._app = app;

    this._container = new Container();
    this._container.x = MARGIN;
    this._container.y = MARGIN;
    this._container.zIndex = 9999;

    const COLORS = [COLOR_GOOD, COLOR_WARN, COLOR_BAD];
    for (let i = 0; i < 3; i++) {
      const color = COLORS[i] ?? COLOR_GOOD;

      // Pre-baked pill background — never redrawn at runtime.
      const pill = new Graphics();
      pill.roundRect(0, 0, PILL_W, PILL_H, PILL_R);
      pill.fill({ color: 0x000000, alpha: 0.55 });
      pill.roundRect(0, 0, PILL_W, PILL_H, PILL_R);
      pill.stroke({ color, width: 1, alpha: 0.6 });
      pill.visible = i === 0;
      this._container.addChild(pill);
      this._pills.push(pill);

      const lbl = new Text({
        text: 'FPS: --',
        style: new TextStyle({ fontFamily: 'monospace', fontSize: 16, fontWeight: 'bold', fill: color }),
      });
      lbl.anchor.set(0.5);
      lbl.x = PILL_W / 2;
      lbl.y = PILL_H / 2 + 1;
      lbl.visible = i === 0;
      this._container.addChild(lbl);
      this._labels.push(lbl);
    }

    this._onTick = this._update.bind(this);
  }

  // ---------------------------------------------------------------------------
  // Lifecycle
  // ---------------------------------------------------------------------------

  public start(): void {
    this._app.stage.addChild(this._container);
    this._app.ticker.add(this._onTick);
  }

  public destroy(): void {
    this._app.ticker.remove(this._onTick);
    this._container.destroy({ children: true });
  }

  // ---------------------------------------------------------------------------
  // Private
  // ---------------------------------------------------------------------------

  private _update(ticker: Ticker): void {
    this._elapsed += ticker.deltaMS;
    if (this._elapsed < FPS_UPDATE_INTERVAL_MS) return;
    this._elapsed = 0;

    const fps = Math.round(ticker.FPS);
    const nextIdx = fps >= 50 ? 0 : fps >= 30 ? 1 : 2;

    // Update text only on the active label (one texture upload per interval).
    const lbl = this._labels[nextIdx];
    if (lbl) lbl.text = `FPS: ${fps}`;

    // Swap visible set only when colour tier changes — zero GPU work otherwise.
    if (nextIdx !== this._activeIdx) {
      const prev = this._activeIdx;
      const prevPill = this._pills[prev];
      const prevLabel = this._labels[prev];
      const nextPill = this._pills[nextIdx];
      const nextLabel = this._labels[nextIdx];
      if (prevPill) prevPill.visible = false;
      if (prevLabel) prevLabel.visible = false;
      if (nextPill) nextPill.visible = true;
      if (nextLabel) nextLabel.visible = true;
      this._activeIdx = nextIdx;
    }
  }
}

