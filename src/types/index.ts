/**
 * @file Global shared types for the application.
 *
 * All cross-cutting type definitions live here to prevent circular imports
 * and to give reviewers a single place to understand the data shapes.
 */

import type { Application } from 'pixi.js';
import type { SceneManager } from '@core/lifecycle/SceneManager';
import type { AssetManager } from '@core/assets/AssetManager';
import type { ResizeManager } from '@core/rendering/ResizeManager';

// ---------------------------------------------------------------------------
// Scene identifiers
// ---------------------------------------------------------------------------

/** All valid scene identifiers in the application. */
export type SceneId = 'menu' | 'ace-of-shadows' | 'magic-words' | 'phoenix-flame';

// ---------------------------------------------------------------------------
// Application context
// ---------------------------------------------------------------------------

/**
 * Shared context object injected into every scene via {@link Scene.init}.
 *
 * Passed by reference — scenes must never store it beyond their own lifecycle.
 * All fields are readonly to prevent accidental mutation from within scenes.
 */
export interface AppContext {
  /** The root PixiJS Application instance. */
  readonly app: Application;
  /** Central scene transition manager. */
  readonly sceneManager: SceneManager;
  /** Central asset loader / unloader with ownership tagging. */
  readonly assetManager: AssetManager;
  /** Central viewport resize pipeline. */
  readonly resizeManager: ResizeManager;
  /** True when the app is launched with `?debug=1`. */
  readonly debug: boolean;
}

// ---------------------------------------------------------------------------
// Easing
// ---------------------------------------------------------------------------

/**
 * A pure easing function: takes normalised time `t ∈ [0, 1]`
 * and returns a transformed progress value (also typically `[0, 1]`).
 */
export type EasingFn = (t: number) => number;
