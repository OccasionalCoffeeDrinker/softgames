/**
 * @file Debug overlay — only visible when `?debug=1` is in the URL.
 *
 * Displays a minimal set of runtime metrics:
 * - Current FPS
 * - Active tween count
 * - Particle pool usage (N / 10)
 * - Current scene name
 *
 * Deliberately kept small — a cluttered overlay is harder to read than a focused one.
 * Activated exclusively via URL query parameter to ensure zero impact in production.
 */

import { Text, TextStyle, Graphics, Container } from 'pixi.js';
import type { Application, Ticker } from 'pixi.js';
import type { SceneManager } from '@core/lifecycle/SceneManager';

/** Metrics that can be pushed to the overlay from various systems. */
export interface DebugMetrics {
  activeTweens: number;
  activeParticles: number;
  particleCap: number;
}

/** Refresh interval in milliseconds. */
const UPDATE_INTERVAL_MS = 200;

/** Width of the overlay panel. */
const PANEL_WIDTH = 180;

/** Safe area margin from top-right corner. */
const MARGIN = 12;

/**
 * Optional debug overlay — toggled via `?debug=1`.
 *
 * Usage:
 * ```ts
 * if (debug) {
 *   const overlay = new DebugOverlay(app, sceneManager);
 *   overlay.start();
 * }
 * ```
 */
export class DebugOverlay {
  private readonly _app: Application;
  private readonly _sceneManager: SceneManager;

  private readonly _container: Container;
  private readonly _bg: Graphics;
  private readonly _label: Text;

  private _elapsed = 0;
  private _metrics: DebugMetrics = { activeTweens: 0, activeParticles: 0, particleCap: 10 };

  private readonly _onTick: (ticker: Ticker) => void;

  public constructor(app: Application, sceneManager: SceneManager) {
    this._app = app;
    this._sceneManager = sceneManager;

    this._container = new Container();
    this._container.zIndex = 10000;

    this._bg = new Graphics();
    this._container.addChild(this._bg);

    const style = new TextStyle({
      fontFamily: 'monospace',
      fontSize: 12,
      fill: 0xffffff,
      lineHeight: 18,
    });

    this._label = new Text({ text: '', style });
    this._label.x = 8;
    this._label.y = 6;
    this._container.addChild(this._label);

    this._onTick = this._update.bind(this);
  }

  // ---------------------------------------------------------------------------
  // Lifecycle
  // ---------------------------------------------------------------------------

  /** Attach the overlay to the stage and start the update loop. */
  public start(): void {
    this._app.stage.addChild(this._container);
    this._app.ticker.add(this._onTick);
    this._positionPanel();
  }

  /** Remove the overlay from the stage. */
  public destroy(): void {
    this._app.ticker.remove(this._onTick);
    this._container.destroy({ children: true });
  }

  // ---------------------------------------------------------------------------
  // Metrics
  // ---------------------------------------------------------------------------

  /**
   * Push updated metrics from game systems.
   * Called by PhoenixFlameScene and other scenes that have relevant data.
   *
   * @param metrics - Partial metrics update (unset properties retain previous values).
   */
  public setMetrics(metrics: Partial<DebugMetrics>): void {
    this._metrics = { ...this._metrics, ...metrics };
  }

  // ---------------------------------------------------------------------------
  // Private
  // ---------------------------------------------------------------------------

  /** Position the panel in the top-right corner. */
  private _positionPanel(): void {
    this._container.x = this._app.renderer.width - PANEL_WIDTH - MARGIN;
    this._container.y = MARGIN;
  }

  private _update(ticker: Ticker): void {
    this._elapsed += ticker.deltaMS;

    if (this._elapsed < UPDATE_INTERVAL_MS) return;
    this._elapsed = 0;

    const fps = Math.round(ticker.FPS);
    const scene = this._sceneManager.current?.id ?? 'none';
    const { activeTweens, activeParticles, particleCap } = this._metrics;

    const lines = [
      `[DEBUG]`,
      `FPS:     ${fps}`,
      `Tweens:  ${activeTweens}`,
      `Ptcls:   ${activeParticles} / ${particleCap}`,
      `Scene:   ${scene}`,
    ];

    this._label.text = lines.join('\n');

    // Resize the background to match the text
    const textHeight = this._label.height;
    this._bg.clear();
    this._bg
      .rect(0, 0, PANEL_WIDTH, textHeight + 12)
      .fill({ color: 0x000000, alpha: 0.6 });

    // Re-position in case the canvas was resized
    this._positionPanel();
  }
}
