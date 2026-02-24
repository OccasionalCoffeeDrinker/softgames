/**
 * @file Central scene transition manager.
 *
 * Enforces a strict and deterministic lifecycle for every scene transition:
 *   1. current.exit()          — interruption-safe (scene kills its own state)
 *   2. current.tweens.killAll()— double-safety: SceneManager ensures no orphaned tweens
 *                                regardless of whether a scene forgot to kill them
 *   3. current.destroy()       — full teardown, asset unload
 *   4. stage.removeChild()     — detach from display tree
 *   5. next.init(ctx)          — one-time setup
 *   6. stage.addChild()        — attach to display tree
 *   7. next.enter()            — start logic
 *   8. next.resize(w, h)       — apply current viewport
 *
 * This order guarantees that mid-animation scene switches are always safe.
 */

import { Container } from 'pixi.js';
import type { Scene } from './Scene';
import type { AppContext } from '../../types/index';

/**
 * Manages transitions between scenes.
 *
 * There is exactly one instance of SceneManager per application,
 * created in {@link Application} and passed through {@link AppContext}.
 */
export class SceneManager {
  /** The root stage container. Scenes are children of this. */
  private readonly _stage: Container;

  /** The context injected into each scene on init. */
  private _ctx: AppContext | null = null;

  /** Currently active scene, if any. */
  private _current: Scene | null = null;

  /** Current viewport dimensions — kept in sync by ResizeManager. */
  private _width: number = window.innerWidth;
  private _height: number = window.innerHeight;

  public constructor(stage: Container) {
    this._stage = stage;
  }

  // ---------------------------------------------------------------------------
  // Setup
  // ---------------------------------------------------------------------------

  /**
   * Provide the AppContext after all services are wired up.
   * Must be called once before the first `go()` call.
   */
  public setContext(ctx: AppContext): void {
    this._ctx = ctx;
  }

  /**
   * Update stored viewport dimensions.
   * Called by ResizeManager on every resize event.
   */
  public setSize(w: number, h: number): void {
    this._width = w;
    this._height = h;
  }

  // ---------------------------------------------------------------------------
  // Transition
  // ---------------------------------------------------------------------------

  /**
   * Transition to a new scene.
   *
   * The previous scene is fully torn down before the next one is initialised,
   * ensuring no two scenes are active simultaneously.
   *
   * @param next - The new scene to transition into.
   */
  public go(next: Scene): void {
    if (!this._ctx) {
      throw new Error('[SceneManager] AppContext not set — call setContext() before go().');
    }

    // --- Tear down current scene ---
    if (this._current) {
      // 1. Scene cleans up its own state (timers, model flags, async cancellation)
      this._current.exit();

      // 2. Double-safety: kill any tweens the scene may have missed in exit()
      //    TweenManager.killAll() is idempotent — safe to call twice.
      this._current.tweens.killAll();

      // 3. Release containers, sprites and scene-scoped asset bundles
      this._current.destroy();

      // 4. Remove from display tree
      this._stage.removeChild(this._current.root);
    }

    // --- Set up next scene ---
    this._current = next;

    // 5. One-time setup
    next.init(this._ctx);

    // 6. Attach to display tree (after init so root container exists)
    this._stage.addChild(next.root);

    // 7. Start logic
    next.enter();

    // 8. Apply current viewport immediately
    next.resize(this._width, this._height);
  }

  // ---------------------------------------------------------------------------
  // Per-frame update
  // ---------------------------------------------------------------------------

  /**
   * Forward the Ticker delta to the active scene.
   * Called every frame from the root Ticker callback in {@link Application}.
   *
   * @param dt - Delta time in milliseconds.
   */
  public update(dt: number): void {
    this._current?.update(dt);
  }

  // ---------------------------------------------------------------------------
  // Resize
  // ---------------------------------------------------------------------------

  /**
   * Forward a resize event to the active scene.
   * Called by ResizeManager after the renderer has been resized.
   *
   * @param w - New viewport width in pixels.
   * @param h - New viewport height in pixels.
   */
  public resize(w: number, h: number): void {
    this.setSize(w, h);
    this._current?.resize(w, h);
  }

  // ---------------------------------------------------------------------------
  // Accessors
  // ---------------------------------------------------------------------------

  /** The currently active scene, or null if no transition has occurred yet. */
  public get current(): Scene | null {
    return this._current;
  }
}
