/**
 * @file Scene-scoped tween manager.
 *
 * Design decisions (see docs/DECISIONS.md):
 * - Custom implementation over a library (GSAP, etc.) to avoid external
 *   dependencies and to give full control over the `killAll()` lifecycle hook.
 * - Scoped per scene instance — no global registry, no cross-scene leaks.
 * - Tweens are registered as plain objects and updated in a single Set loop,
 *   keeping per-frame allocations at zero after initial registration.
 */

import type { EasingFn } from '../../types/index';

// ---------------------------------------------------------------------------
// Easing helpers (inlined — no extra import required)
// ---------------------------------------------------------------------------

/** Linear (no easing). */
export const linear: EasingFn = (t) => t;

/** Ease-out quadratic — fast start, soft landing. Used for card moves. */
export const easeOutQuad: EasingFn = (t) => t * (2 - t);

/** Ease-in-out quadratic — smooth on both ends. */
export const easeInOutQuad: EasingFn = (t) => (t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t);

// ---------------------------------------------------------------------------
// Internal tween representation
// ---------------------------------------------------------------------------

/** Internal tween state — not exposed publicly. */
interface TweenState {
  elapsed: number;         // starts at 0 after delay; negative while waiting
  readonly duration: number;
  readonly easing: EasingFn;
  readonly onUpdate: (progress: number) => void;
  readonly onComplete?: () => void;
  killed: boolean;
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Options for creating a new tween.
 */
export interface TweenOptions {
  /**
   * Total duration of the tween in milliseconds.
   * Must be a positive number.
   */
  duration: number;

  /**
   * Easing function applied to the normalised time.
   * Defaults to {@link easeOutQuad}.
   */
  easing?: EasingFn;

  /**
   * Called every frame with the current eased progress value in `[0, 1]`.
   * Apply the value to your target property here.
   */
  onUpdate: (progress: number) => void;

  /**
   * Optional delay before the tween starts, in milliseconds.
   * The `onUpdate` callback is not called until the delay has elapsed.
   */
  delay?: number;

  /**
   * Called once when the tween reaches its end (progress = 1).
   * Not called if the tween is killed before completion.
   */
  onComplete?: () => void;
}

/**
 * A handle returned by {@link TweenManager.add}.
 * Call it to cancel the tween before completion.
 */
export type TweenCancelFn = () => void;

/**
 * Scene-scoped tween manager.
 *
 * Usage:
 * ```ts
 * const cancel = this.tweens.add({
 *   duration: 2000,
 *   easing: easeOutQuad,
 *   onUpdate: (p) => { sprite.x = lerp(fromX, toX, p); },
 *   onComplete: () => { onLanded(); },
 * });
 * ```
 *
 * All active tweens are killed automatically when the scene exits via
 * {@link SceneManager.go}, which always calls `tweens.killAll()` after `exit()`.
 */
export class TweenManager {
  private readonly _tweens: Set<TweenState> = new Set<TweenState>();

  // ---------------------------------------------------------------------------
  // Public API
  // ---------------------------------------------------------------------------

  /**
   * Register a new tween and start it immediately.
   *
   * @param options - Tween configuration.
   * @returns A cancel function — call it to kill the tween before completion.
   */
  public add(options: TweenOptions): TweenCancelFn {
    const tween: TweenState = {
      elapsed: -(options.delay ?? 0),  // negative = still in delay phase
      duration: options.duration,
      easing: options.easing ?? easeOutQuad,
      onUpdate: options.onUpdate,
      ...(options.onComplete !== undefined ? { onComplete: options.onComplete } : {}),
      killed: false,
    };

    this._tweens.add(tween);

    return (): void => {
      tween.killed = true;
      this._tweens.delete(tween);
    };
  }

  /**
   * Advance all active tweens by `dt` milliseconds.
   * Completed tweens are removed from the set automatically.
   *
   * Called once per frame by the scene's `update(dt)` method.
   *
   * @param dt - Delta time in milliseconds.
   */
  public update(dt: number): void {
    for (const tween of this._tweens) {
      if (tween.killed) {
        this._tweens.delete(tween);
        continue;
      }

      tween.elapsed += dt;
      // Still in delay phase — skip update but keep accumulating.
      if (tween.elapsed < 0) continue;

      const rawT = Math.min(tween.elapsed / tween.duration, 1);
      const easedT = tween.easing(rawT);

      tween.onUpdate(easedT);

      if (rawT >= 1) {
        tween.onComplete?.();
        this._tweens.delete(tween);
      }
    }
  }

  /**
   * Kill all active tweens immediately.
   *
   * Does NOT call `onComplete` — use this for interruption scenarios only.
   * Idempotent: safe to call when no tweens are active.
   */
  public killAll(): void {
    for (const tween of this._tweens) {
      tween.killed = true;
    }
    this._tweens.clear();
  }

  /** Number of currently active (non-killed) tweens. Useful for debug overlays. */
  public get activeCount(): number {
    return this._tweens.size;
  }
}
