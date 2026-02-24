/**
 * @file Asset manager with tagged ownership.
 *
 * Design decisions (see docs/DECISIONS.md):
 *
 * Assets are tagged as either `shared` or `scene:<id>`:
 * - `shared` assets (UI fonts, icons, common textures) are loaded once and
 *   never destroyed — their BaseTexture is shared across scenes.
 * - `scene:<id>` assets are loaded per-scene and fully destroyed on scene exit,
 *   including their BaseTexture, to reclaim GPU memory on low-end mobile devices.
 *
 * This avoids the classic Pixi pitfall of destroying a shared BaseTexture and
 * causing white-square artifacts on other scenes that reference the same resource.
 *
 * Uses the Pixi v8 Assets API (bundle-based loading) for clean grouped load/unload.
 */

import { Assets, Texture } from 'pixi.js';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** Tag identifying asset ownership scope. */
export type AssetTag = 'shared' | `scene:${string}`;

/**
 * A registered asset bundle entry.
 */
export interface AssetBundle {
  /** Unique bundle name — used as the key for load/unload calls. */
  name: string;
  /** Ownership tag — determines whether the bundle is destroyed on scene exit. */
  tag: AssetTag;
  /** Pixi Assets manifest: record of alias → URL pairs. */
  manifest: Record<string, string>;
}

// ---------------------------------------------------------------------------
// AssetManager
// ---------------------------------------------------------------------------

/**
 * Central asset loader with tagged ownership.
 *
 * Usage:
 * ```ts
 * // Register during Application bootstrap (shared assets)
 * assetManager.registerBundle({ name: 'ui', tag: 'shared', manifest: { logo: '/assets/logo.png' } });
 *
 * // Register in Scene.init() (scene-scoped assets)
 * assetManager.registerBundle({ name: 'cards', tag: 'scene:ace-of-shadows', manifest: { card: '/assets/card.png' } });
 *
 * // Load in Scene.init() or Scene.enter()
 * await assetManager.loadBundle('cards');
 *
 * // Retrieve loaded texture
 * const texture = assetManager.getTexture('card');
 *
 * // Unload on Scene.destroy() (scene-scoped only)
 * await assetManager.unloadSceneBundle('ace-of-shadows');
 * ```
 */
export class AssetManager {
  /** Registry of all known bundles by name. */
  private readonly _bundles: Map<string, AssetBundle> = new Map<string, AssetBundle>();

  // ---------------------------------------------------------------------------
  // Registration
  // ---------------------------------------------------------------------------

  /**
   * Register an asset bundle.
   * Must be called before `loadBundle()`.
   * Safe to call multiple times with the same name (re-registers silently).
   *
   * @param bundle - Bundle descriptor including name, tag, and manifest.
   */
  public registerBundle(bundle: AssetBundle): void {
    this._bundles.set(bundle.name, bundle);

    Assets.addBundle(bundle.name, bundle.manifest);
  }

  // ---------------------------------------------------------------------------
  // Loading
  // ---------------------------------------------------------------------------

  /**
   * Load a previously registered bundle.
   * Returns immediately if the bundle is already cached by Pixi Assets.
   *
   * @param name - Bundle name as used in `registerBundle()`.
   */
  public async loadBundle(name: string): Promise<void> {
    if (!this._bundles.has(name)) {
      throw new Error(`[AssetManager] Bundle "${name}" is not registered.`);
    }

    await Assets.loadBundle(name);
  }

  // ---------------------------------------------------------------------------
  // Retrieval
  // ---------------------------------------------------------------------------

  /**
   * Retrieve a loaded texture by its alias.
   *
   * Throws if the texture is not found — fail-fast is intentional to surface
   * missing asset registrations early in development.
   *
   * @param alias - The alias key defined in the bundle manifest.
   */
  public getTexture(alias: string): Texture {
    const texture = Assets.get<Texture | undefined>(alias);

    if (!texture) {
      throw new Error(`[AssetManager] Texture "${alias}" not found. Has its bundle been loaded?`);
    }

    return texture;
  }

  /**
   * Attempt to get a texture by alias without throwing.
   * Returns `null` if not found — useful for optional / remote assets.
   *
   * @param alias - The alias key defined in the bundle manifest.
   */
  public tryGetTexture(alias: string): Texture | null {
    return (Assets.get<Texture>(alias) as Texture | undefined) ?? null;
  }

  // ---------------------------------------------------------------------------
  // Unloading
  // ---------------------------------------------------------------------------

  /**
   * Unload and destroy all scene-scoped asset bundles for the given scene.
   *
   * Only bundles tagged `scene:<sceneId>` are affected.
   * Shared bundles (tagged `shared`) are intentionally skipped to avoid
   * destroying shared BaseTextures that other scenes still reference.
   *
   * @param sceneId - The scene identifier (e.g. `'ace-of-shadows'`).
   */
  public async unloadSceneBundle(sceneId: string): Promise<void> {
    const targetTag: AssetTag = `scene:${sceneId}`;

    for (const [name, bundle] of this._bundles) {
      if (bundle.tag === targetTag) {
        await Assets.unloadBundle(name);
        this._bundles.delete(name);
      }
    }
  }
}
