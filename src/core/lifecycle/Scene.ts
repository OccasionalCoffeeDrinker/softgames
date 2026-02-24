/**
 * @file Scene lifecycle contract.
 *
 * Every screen in the application (Menu, AceOfShadows, MagicWords, PhoenixFlame)
 * must implement this interface. The contract guarantees deterministic cleanup,
 * interruption safety, and a consistent update pipeline.
 *
 * Lifecycle order enforced by {@link SceneManager}:
 *   init → enter → [update / resize]* → exit → destroy
 */

import type { Container } from 'pixi.js';
import type { AppContext, SceneId } from '@app-types/index';
import type { TweenManager } from './TweenManager';

/**
 * Core scene contract.
 *
 * Ownership rules:
 * - `root` container and all its children are owned by the scene.
 * - `tweens` instance is owned by the scene and scoped exclusively to it.
 * - On `destroy()`, both must be fully cleaned up.
 */
export interface Scene {
  /** Unique identifier — used by SceneManager for routing. */
  readonly id: SceneId;

  /**
   * Root display container added/removed from the stage by SceneManager.
   * The scene is responsible for populating and destroying this container.
   */
  readonly root: Container;

  /**
   * Scene-scoped tween manager.
   *
   * SceneManager calls `tweens.killAll()` as a double-safety measure after
   * `exit()` returns, so in-flight tweens can never outlive a scene transition
   * regardless of whether a scene forgets to kill them in its own `exit()`.
   */
  readonly tweens: TweenManager;

  /**
   * One-time setup — called once before `enter()`.
   * Allocate display objects, load scene-scoped assets, wire up event listeners.
   *
   * @param ctx - Shared application context. Do not store beyond the scene lifecycle.
   */
  init(ctx: AppContext): void;

  /**
   * Start the scene — called after `init()`.
   * Begin timers, subscribe to the Ticker, run entrance animations.
   */
  enter(): void;

  /**
   * Per-frame update, driven by the PixiJS Ticker.
   *
   * @param dt - Delta time in milliseconds (normalised to 60 fps by Pixi Ticker).
   */
  update(dt: number): void;

  /**
   * Respond to viewport size changes.
   * Called once on `enter()` and again whenever the window resizes.
   *
   * @param w - Current viewport width in pixels.
   * @param h - Current viewport height in pixels.
   */
  resize(w: number, h: number): void;

  /**
   * Interrupt-safe exit.
   *
   * **Must be safe to call at any point, including mid-animation.**
   *
   * Required actions:
   * 1. `this.tweens.killAll()` — stop all in-flight tweens.
   * 2. Reset any model state flags (e.g. `isMoving = false` on all cards).
   * 3. Clear all `setInterval` / `setTimeout` handles.
   * 4. Cancel pending async operations (abort flags or AbortController).
   */
  exit(): void;

  /**
   * Full teardown — called after `exit()`.
   * Destroy scene-owned containers, sprites, and unload scene-scoped asset bundles.
   * After this call the scene instance must not be used again.
   */
  destroy(): void;
}
