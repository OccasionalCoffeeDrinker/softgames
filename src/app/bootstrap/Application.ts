/**
 * @file Application bootstrap.
 *
 * Responsibilities:
 * 1. Initialise the PixiJS Application (async in Pixi v8).
 * 2. Instantiate and wire up all core services.
 * 3. Build the AppContext and inject it into the SceneManager.
 * 4. Start the FPS meter (always) and debug overlay (if `?debug=1`).
 * 5. Register the global Ticker update loop.
 * 6. Load shared assets.
 * 7. Navigate to the MenuScene.
 */

import { Application as PixiApplication } from 'pixi.js';
import { AppConfig } from '@app/config/AppConfig';
import { SceneManager } from '@core/lifecycle/SceneManager';
import { AssetManager } from '@core/assets/AssetManager';
import { ResizeManager } from '@core/rendering/ResizeManager';
import { FPSMeter } from '@core/diagnostics/FPSMeter';
import { DebugOverlay } from '@core/diagnostics/DebugOverlay';
import { readUrlFlag, log } from '@core/utils/debug';
import { MenuScene } from '@scenes/MenuScene';
import type { AppContext } from '@app-types/index';

/**
 * Entry point for the entire application.
 *
 * Usage (from `main.ts`):
 * ```ts
 * const app = new Application();
 * await app.start();
 * ```
 */
export class Application {
  private readonly _pixi: PixiApplication;
  private readonly _sceneManager: SceneManager;
  private readonly _assetManager: AssetManager;
  private readonly _resizeManager: ResizeManager;
  private readonly _fpsMeter: FPSMeter;
  private readonly _debugOverlay: DebugOverlay | null;
  private readonly _debug: boolean;

  public constructor() {
    this._debug = readUrlFlag(AppConfig.DEBUG_FLAG);

    // --- Core PixiJS app ---
    this._pixi = new PixiApplication();

    // --- Services ---
    this._sceneManager = new SceneManager(this._pixi.stage);
    this._assetManager = new AssetManager();
    this._resizeManager = new ResizeManager(this._pixi, this._sceneManager);

    // --- Diagnostics ---
    this._fpsMeter = new FPSMeter(this._pixi);
    this._debugOverlay = this._debug
      ? new DebugOverlay(this._pixi, this._sceneManager)
      : null;
  }

  // ---------------------------------------------------------------------------
  // Startup
  // ---------------------------------------------------------------------------

  /**
   * Fully initialise and start the application.
   * Must be awaited — PixiJS v8 requires async initialisation.
   */
  public async start(): Promise<void> {
    const mountPoint = document.getElementById('app');

    if (!mountPoint) {
      throw new Error('[Application] Mount point #app not found in the DOM.');
    }

    // --- Initialise Pixi renderer ---
    await this._pixi.init({
      background: AppConfig.BACKGROUND_COLOR,
      resizeTo: window,
      // antialias off — on integrated GPUs antialiasing alone can drop FPS by ~15.
      antialias: false,
      autoDensity: true,
      // Cap at 1.25×: visible quality is near-identical to 1.5×/2× at card sizes,
      // but renders up to 2.56× fewer pixels on a Retina display.
      resolution: Math.min(window.devicePixelRatio, 1.25),
      // Prefer the discrete GPU on dual-GPU laptops.
      powerPreference: 'high-performance',
    });

    mountPoint.appendChild(this._pixi.canvas);
    this._mountFullscreenButton(mountPoint);

    // No maxFPS cap — let the Ticker follow the native display refresh rate
    // (60 Hz, 120 Hz, 144 Hz, etc.).  A hard 60 cap on a 120 Hz screen causes
    // uneven wait intervals that can look like FPS drops to ~40.

    log('info', `Application initialised. Debug: ${String(this._debug)}`, this._debug);

    // --- Wire AppContext ---
    const ctx: AppContext = {
      app: this._pixi,
      sceneManager: this._sceneManager,
      assetManager: this._assetManager,
      resizeManager: this._resizeManager,
      debug: this._debug,
    };

    this._sceneManager.setContext(ctx);

    // --- Start diagnostics ---
    this._fpsMeter.start();
    this._debugOverlay?.start();

    // --- Start resize pipeline ---
    this._resizeManager.start();

    // --- Register global Ticker update loop ---
    this._pixi.ticker.add((ticker) => {
      this._sceneManager.update(ticker.deltaMS);
    });

    // --- Load shared assets then navigate to Menu ---
    this._loadSharedAssets();
    this._sceneManager.go(new MenuScene());
  }

  // ---------------------------------------------------------------------------
  // Private
  // ---------------------------------------------------------------------------

  /**
   * Injects a small fullscreen-toggle button as an HTML element positioned
   * absolute top-right of the canvas mount point.
   *
   * Using an HTML element (not a Pixi display object) ensures it is always
   * rendered on top regardless of the active scene's display list, and keeps
   * the Pixi stage free of UI chrome.
   */
  private _mountFullscreenButton(mountPoint: HTMLElement): void {
    const ICON_ENTER =
      '<svg viewBox="0 0 24 24"><path d="M8 3H5a2 2 0 0 0-2 2v3"/>' +
      '<path d="M16 3h3a2 2 0 0 1 2 2v3"/>' +
      '<path d="M8 21H5a2 2 0 0 1-2-2v-3"/>' +
      '<path d="M16 21h3a2 2 0 0 0 2-2v-3"/></svg>';
    const ICON_EXIT =
      '<svg viewBox="0 0 24 24"><path d="M8 3v3a2 2 0 0 1-2 2H3"/>' +
      '<path d="M16 3v3a2 2 0 0 0 2 2h3"/>' +
      '<path d="M8 21v-3a2 2 0 0 0-2-2H3"/>' +
      '<path d="M16 21v-3a2 2 0 0 1 2-2h3"/></svg>';

    const btn = document.createElement('button');
    btn.id = 'fullscreen-btn';
    btn.title = 'Toggle fullscreen';
    btn.setAttribute('aria-label', 'Toggle fullscreen');
    btn.innerHTML = ICON_ENTER;

    btn.addEventListener('click', () => {
      if (!document.fullscreenElement) {
        void mountPoint.requestFullscreen();
      } else {
        void document.exitFullscreen();
      }
    });

    document.addEventListener('fullscreenchange', () => {
      btn.innerHTML = document.fullscreenElement ? ICON_EXIT : ICON_ENTER;
      btn.title = document.fullscreenElement ? 'Exit fullscreen' : 'Toggle fullscreen';
    });

    mountPoint.appendChild(btn);
  }

  /**
   * Load all assets tagged `shared`.
   * These are never unloaded — they persist across all scene transitions.
   */
  private _loadSharedAssets(): void {
    // Currently no shared assets are needed before the Menu renders.
    // Add shared font atlases, common sprites, etc. here when required.
    log('debug', 'Shared assets loaded (none registered yet).', this._debug);
  }
}
