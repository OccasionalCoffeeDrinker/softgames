/**
 * @file Central viewport resize pipeline.
 *
 * Responsibilities:
 * - Listen to window resize events (debounced to avoid excessive updates).
 * - Resize the PixiJS renderer to match the new viewport dimensions.
 * - Propagate the new dimensions to the SceneManager and any registered listeners.
 *
 * All scenes receive resize notifications via SceneManager.resize(), so they
 * never need to listen to the window directly.
 */

import type { Application } from 'pixi.js';
import type { SceneManager } from '@core/lifecycle/SceneManager';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** A callback invoked whenever the viewport changes size. */
export type ResizeListener = (width: number, height: number) => void;

// ---------------------------------------------------------------------------
// ResizeManager
// ---------------------------------------------------------------------------

/**
 * Central viewport manager — single source of truth for canvas dimensions.
 *
 * Usage:
 * ```ts
 * const resizeManager = new ResizeManager(app, sceneManager);
 * resizeManager.start();
 * // ... later, during teardown:
 * resizeManager.destroy();
 * ```
 */
export class ResizeManager {
  private readonly _app: Application;
  private readonly _sceneManager: SceneManager;

  /** Additional listeners beyond the SceneManager (e.g. FPS meter overlay). */
  private readonly _listeners: Set<ResizeListener> = new Set<ResizeListener>();

  /** Debounce timer handle. */
  private _debounceHandle: ReturnType<typeof setTimeout> | null = null;

  /** Debounce delay in milliseconds — balances responsiveness and performance. */
  private static readonly DEBOUNCE_MS = 100;

  /** Bound reference kept so the listener can be removed cleanly. */
  private readonly _onWindowResize: () => void;

  public constructor(app: Application, sceneManager: SceneManager) {
    this._app = app;
    this._sceneManager = sceneManager;
    this._onWindowResize = this._handleResize.bind(this);
  }

  // ---------------------------------------------------------------------------
  // Lifecycle
  // ---------------------------------------------------------------------------

  /**
   * Start listening for resize events and apply the initial viewport size.
   */
  public start(): void {
    window.addEventListener('resize', this._onWindowResize);
    // Apply current size immediately so the first scene gets the correct dimensions.
    this._applySize(window.innerWidth, window.innerHeight);
  }

  /**
   * Stop listening for resize events and clean up.
   * Call this when the application is fully torn down.
   */
  public destroy(): void {
    window.removeEventListener('resize', this._onWindowResize);

    if (this._debounceHandle !== null) {
      clearTimeout(this._debounceHandle);
      this._debounceHandle = null;
    }

    this._listeners.clear();
  }

  // ---------------------------------------------------------------------------
  // Listeners
  // ---------------------------------------------------------------------------

  /**
   * Register an additional resize listener (e.g. debug overlay, FPS meter).
   *
   * @param listener - Callback receiving the new width and height.
   */
  public addListener(listener: ResizeListener): void {
    this._listeners.add(listener);
  }

  /**
   * Remove a previously registered resize listener.
   *
   * @param listener - The exact reference passed to `addListener()`.
   */
  public removeListener(listener: ResizeListener): void {
    this._listeners.delete(listener);
  }

  // ---------------------------------------------------------------------------
  // Accessors
  // ---------------------------------------------------------------------------

  /** Current viewport width in pixels. */
  public get width(): number {
    return this._app.renderer.width;
  }

  /** Current viewport height in pixels. */
  public get height(): number {
    return this._app.renderer.height;
  }

  // ---------------------------------------------------------------------------
  // Private
  // ---------------------------------------------------------------------------

  /** Debounced handler for window resize events. */
  private _handleResize(): void {
    if (this._debounceHandle !== null) {
      clearTimeout(this._debounceHandle);
    }

    this._debounceHandle = setTimeout(() => {
      this._debounceHandle = null;
      this._applySize(window.innerWidth, window.innerHeight);
    }, ResizeManager.DEBOUNCE_MS);
  }

  /**
   * Resize the renderer and propagate the new dimensions to all subscribers.
   *
   * @param w - New viewport width in pixels.
   * @param h - New viewport height in pixels.
   */
  private _applySize(w: number, h: number): void {
    this._app.renderer.resize(w, h);
    this._sceneManager.resize(w, h);

    for (const listener of this._listeners) {
      listener(w, h);
    }
  }
}
