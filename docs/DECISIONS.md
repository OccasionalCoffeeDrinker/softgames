# Architecture Decision Records

Decisions made during development, reasoning included for reviewers.

---

## ADR-001 — Custom TweenManager over GSAP / Tween.js

**Status:** Accepted

**Context:** The project needs tween animations for card movements and entrance effects. Several battle-tested libraries exist (GSAP, @tweenjs/tween.js).

**Decision:** Implement a minimal custom `TweenManager` (~100 LOC).

**Reasoning:**
- Zero external runtime dependencies for this feature
- The SceneManager lifecycle requires a `killAll()` hook that is called deterministically on every scene transition — this is trivially implemented in a custom manager but would require careful GSAP context management
- The set of required easing curves (linear, easeOutQuad, easeInOutQuad) is small and inlinable
- Custom implementation means full control in future milestones

---

## ADR-002 — `@types/*` path alias renamed to `@app-types/*`

**Status:** Accepted

**Context:** TypeScript reserves the `@types` namespace for ambient declaration packages (DefinitelyTyped). Using `@types/*` as a path alias in `tsconfig.json` triggers `TS6137`.

**Decision:** The project-internal types path alias is `@app-types/*` → `src/types/*`.

---

## ADR-003 — API response field `emojies` is intentional

**Status:** Accepted

**Context:** The Softgames mock API (`/v2/magicwords`) returns the field as `emojies` (misspelled). Renaming it locally would break the type guard against the live payload.

**Decision:** The TypeScript interface mirrors the API exactly: `emojies: EmojiDefinition[]`. A comment is placed on the interface documenting this.

---

## ADR-004 — Scene owns `TweenManager` instance (not shared global)

**Status:** Accepted

**Context:** A global tween registry (e.g. a singleton `TweenManager`) would require explicit cleanup on every scene exit and would make it easy for orphaned tweens to outlive their scene.

**Decision:** Each scene holds `public readonly tweens: TweenManager`. `SceneManager.go()` always calls `current.tweens.killAll()` as a double-safety step regardless of whether the scene's own `exit()` did so.

---

## ADR-005 — `exactOptionalPropertyTypes: true` in tsconfig

**Status:** Accepted

**Context:** TypeScript's default behaviour allows `{ key: undefined }` to satisfy `{ key?: string }`. This hides real bugs where an optional property is explicitly set to `undefined`.

**Decision:** Enabled. Consequence: objects with optional properties must use conditional spread when building from potentially-undefined sources:
```ts
...(options.onComplete !== undefined ? { onComplete: options.onComplete } : {})
```

---

## ADR-006 — AssetManager tagged ownership model

**Status:** Accepted

**Context:** Destroying a `BaseTexture` that is still in use by another `Sprite` produces a white square / black screen. This is a common PixiJS pitfall on scene transitions.

**Decision:** Assets carry a `tag` (`'shared'` or `'scene:<id>'`). The `unloadSceneBundle(sceneId)` method only calls `texture.destroy(true)` on assets tagged `scene:<sceneId>`. Shared assets are never destroyed during a play session.

---

## ADR-007 — `Math.sin` for Phoenix Flame sway (not lookup table)

**Status:** Accepted

**Context:** The `buildLookupTable` utility exists for performance-critical loops. Phoenix Flame has a hard cap of 10 particles.

**Decision:** `Math.sin` directly, justified by the small particle count. The lookup table utility remains available for scenarios with higher iteration counts (e.g. if the cap is raised or a second particle layer is added).

---

## ADR-008 — GitHub Pages as primary deploy target

**Status:** Accepted

**Context:** The assignment requires a publicly hosted demo URL. Options considered: Vercel, Netlify, GitHub Pages.

**Decision:** GitHub Pages via `peaceiris/actions-gh-pages`. It requires no additional account setup beyond the existing GitHub repo, and the CI workflow already builds the dist on every push to `main`.

---

## ADR-009 — Dynamic import for back-navigation in feature scenes

**Status:** Accepted

**Context:** Feature scenes need to navigate back to `MenuScene`. A static import would create a circular dependency: `Application → MenuScene → AceOfShadowsScene → MenuScene`.

**Decision:** Feature scenes use `void import('@scenes/MenuScene').then(...)` for the back button. Because `MenuScene` is already statically imported by `Application.ts`, Vite colocates it in the main chunk and the dynamic import resolves immediately from cache. The Vite warning `dynamic import will not move module into another chunk` is expected and harmless.

---

## ADR-010 — Single RenderTexture atlas for all 144 card faces

**Status:** Accepted

**Context:** Each card needs a unique face texture (value + suit combination). Options: 144 individual `RenderTexture` objects, or one shared atlas.

**Decision:** One `RenderTexture` (12 × 12 grid, `CARD_W × CARD_H` per cell). Every `CardView` sprite's texture is a sub-region of that atlas via `new Texture({ source, frame })`.

**Reasoning:**
- All 144 sprites share one GPU texture source → Pixi's batcher issues a single draw call for the entire deck (vs. up to 144 separate draw calls with individual textures).
- Memory footprint is one texture upload instead of 144 separate allocations.
- Sub-texture references are cheap `Texture` wrappers with no additional GPU memory.

---

## ADR-011 — Incremental atlas bake (12 cells / frame) in `update()`

**Status:** Accepted

**Context:** Building all 144 card face `Container` objects and calling `renderer.render()` 144 times in a single frame caused a `rAF handler took Xms` browser performance violation, degrading the initial frame budget.

**Decision:** `_bakeData[]` stores plain data objects (no Pixi display objects). Each `update()` call builds 12 face containers into a single temporary `batchStage`, calls `renderer.render({ container: batchStage, target: atlas, clear: false })` once, then immediately `destroy()`s the stage. 12 frames × 12 cells = 144 cells baked without violating the frame budget.

**Reasoning:**
- Spreading GPU work across 12 frames keeps each frame well inside the 16ms budget.
- One `render()` call per frame (not 12 separate calls) means only 1 GPU context switch per bake frame.
- Destroying `batchStage` immediately after render prevents a GC pressure spike at the end.

---

## ADR-012 — No `maxFPS` cap on the Pixi Ticker

**Status:** Accepted

**Context:** The Ticker was initially capped at 60fps to prevent "doubled tick rate" on 120 Hz monitors. However, on a 120 Hz display a hard 60fps cap forces an irregular wait pattern (every other vsync is skipped), which manifests as apparent FPS oscillation (40–60 range in the browser's performance overlay).

**Decision:** Remove `ticker.maxFPS = 60`. The Ticker runs at the native display refresh rate.

**Reasoning:**
- Pixi's batching means the 120 fps rendering overhead is minimal (the extra frames are near-empty blit operations after the first draw call).
- The FPS meter (`AppConfig.TARGET_FPS`) is used only for the warning threshold display, not for Ticker control.
- A uniform 8ms frame interval (120 Hz) is visibly smoother than a jittery 60fps signal on high-refresh displays.

---

## ADR-015 — Fullscreen toggle as HTML element, not Pixi display object

**Status:** Accepted

**Context:** The brief requires the application to run in full screen. A fullscreen button is needed that is always accessible regardless of which scene is active.

**Decision:** A plain `<button id="fullscreen-btn">` HTML element is injected next to the Pixi canvas by `Application._mountFullscreenButton()`. It calls `mountPoint.requestFullscreen()` / `document.exitFullscreen()` and updates its SVG icon on the `fullscreenchange` event.

**Reasoning:**
- An HTML element lives in the browser's paint layer above WebGL, so it is always visible regardless of the active Pixi scene's display list — no scene coordination needed.
- `requestFullscreen()` must be called on a DOM element, not a Pixi object, so an HTML button is the natural fit.
- Keeping the fullscreen chrome out of the Pixi stage avoids polluting every scene's `destroy()` path with HUD teardown logic.

---

## ADR-013 — Real playing-card visual for card faces

**Status:** Accepted

**Context:** The brief required 144 visible sprites; no specification was given for card face appearance.

**Decision:** Cards are rendered as real playing cards: left-edge colour stripe for suit, corner indicators (value + suit symbol) top-left and bottom-right (rotated 180°), pip grid layout for 2–10, court label (J/Q/K) for face cards, oversized suit symbol for Aces. Four suits (♠ ♥ ♦ ♣) cycle across all 144 cards.

**Reasoning:** Demonstrates the graphics/layout capability of PixiJS beyond a plain coloured rectangle, while keeping implementation within the brief's constraints.

---

## ADR-014 — DiceBear fallback for unknown emoji tokens in Magic Words

**Status:** Accepted

**Context:** The Softgames API emoji list does not include tokens such as `{win}` and `{affirmative}` that appear in the dialogue data. Without a fallback these tokens render as `[name]` placeholder text.

**Decision:** After loading the API emoji list, `MagicWordsScene` scans all dialogue tokens. Any token name not present in the API list is auto-fetched from DiceBear (`fun-emoji/png?seed=<Name>`). Tokens that fail the DiceBear fetch fall back gracefully to `[name]` text.

**Reasoning:** Keeps dialogue rendering accurate for all token names without modifying the API contract or hardcoding extra mappings in source code.

