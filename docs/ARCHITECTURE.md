# Architecture

## Overview

A PixiJS v8 + TypeScript single-page application structured around a strict **Scene lifecycle contract**. Three independent feature demos share a common scaffold (menu, asset loading, resize, diagnostics) via an `AppContext` object injected at scene initialisation time.

---

## Directory Structure

```
src/
├── app/
│   ├── bootstrap/       Application.ts — entry wiring
│   └── config/          AppConfig.ts   — all constants in one place
├── core/
│   ├── lifecycle/       Scene.ts · SceneManager.ts · TweenManager.ts
│   ├── assets/          AssetManager.ts
│   ├── rendering/       ResizeManager.ts
│   ├── diagnostics/     FPSMeter.ts · DebugOverlay.ts
│   └── utils/           math.ts · debug.ts
├── features/
│   ├── ace-of-shadows/  M2 — card stack animation
│   ├── magic-words/     M3 — API-driven chat renderer
│   └── phoenix-flame/   M4 — GPU particle fire
├── scenes/
│   └── MenuScene.ts     Main navigation screen
├── types/
│   └── index.ts         SceneId · AppContext · EasingFn
├── ui/
│   ├── theme/           Theme.ts — design tokens
│   └── components/      Button.ts
└── main.ts              Bootstrap entry point
```

---

## Core Abstractions

### Scene Lifecycle Contract

Every screen implements the `Scene` interface:

```
init(ctx)  →  enter()  →  [update(dt) / resize(w,h)]*  →  exit()  →  destroy()
```

| Method     | Purpose |
|------------|---------|
| `init`     | Allocate display objects, register assets. Receives `AppContext`. |
| `enter`    | Start timers, play entrance animations. |
| `update`   | Per-frame logic driven by PixiJS Ticker (dt in ms). |
| `resize`   | Respond to viewport changes. Called once on enter and on every resize. |
| `exit`     | Interrupt-safe cleanup — must be safe to call mid-animation. |
| `destroy`  | Full teardown: containers, textures, event listeners. |

### SceneManager

Enforces the lifecycle order. `go(next)` sequence:

1. `current.exit()` — scene kills its own in-flight state
2. `current.tweens.killAll()` — double-safety, covers any missed tween
3. `current.destroy()`
4. `stage.removeChild(current.root)`
5. `next.init(ctx)`
6. `stage.addChild(next.root)`
7. `next.enter()`
8. `next.resize(w, h)`

### TweenManager

Scoped per scene instance. Drives all tween animations without external dependencies. Key properties:

- `add(options): TweenCancelFn` — register a tween, get a cancel handle
- `update(dt)` — advance all tweens (called from scene's `update`)
- `killAll()` — cancel everything (called by `SceneManager.go()`)
- `activeCount` — observable for `DebugOverlay`

### AssetManager

Tagged ownership model prevents BaseTexture destruction bugs:

- `'shared'` — loaded once, never destroyed (fonts, common sprites)
- `'scene:<id>'` — loaded per scene, unloaded in `destroy()`
- `getTexture(key)` — throws if missing (fail-fast during development)
- `tryGetTexture(key)` — returns `null` (safe for optional assets)

### ResizeManager

Debounced (100ms) resize pipeline:

1. `app.renderer.resize(w, h)`
2. `sceneManager.resize(w, h)`
3. All registered `ResizeListener` callbacks

---

## AppContext

The shared object injected into every scene via `init(ctx)`:

```ts
interface AppContext {
  app:           PixiApplication;
  sceneManager:  SceneManager;
  assetManager:  AssetManager;
  resizeManager: ResizeManager;
  debug:         boolean;
}
```

Scenes must not hold references to `AppContext` beyond their own lifecycle.

---

## Ace of Shadows — Atlas & Card Faces

### RenderTexture Atlas

All 144 card face textures are baked into a single `RenderTexture` (12 columns × 12 rows, `CARD_W × CARD_H` per cell). Every `CardView` is a `Sprite` whose texture is a sub-region of that atlas. Because all 144 sprites share one GPU texture source, Pixi's batcher groups them into a single draw call automatically — no `cacheAsTexture` needed (which would add per-sprite re-composite overhead on every card move).

### Incremental Bake

Atlas cells are not built all at once (that would trigger a `rAF handler took Xms` browser violation). Instead:

1. `_bakeData[]` is populated in `init()` as an array of plain objects (no Pixi display objects yet).
2. Each `update()` call processes `BAKE_PER_FRAME = 12` cells:
   - Builds a temporary `Container` (`batchStage`) with 12 face sub-containers.
   - Calls `renderer.render({ container: batchStage, target: atlas, clear: false })` — one GPU call.
   - Immediately destroys `batchStage` to release GPU memory.
3. A "Preparing cards…" `Text` overlay is displayed during baking. Card movement is gated until `_loadingOverlay === null` (i.e. bake complete).

### Card Face Helpers

`_buildCardFace(bandColor, value, symbol, color)` — module-level function in `AceOfShadowsScene.ts`. Builds a warm-white card container with:
- Left-edge colour stripe (suit colour).
- Top-left corner indicator (value + symbol) and bottom-right (rotated 180°).
- Pip layout via `_pipPositions(value)` for numeric cards (2–10).
- Face-card label (J / Q / K) for court cards.
- Oversized suit symbol for Aces.

---

## Performance Constraints

| Constraint | Rule |
|---|---|
| Particle cap | Hard limit of `AppConfig.PARTICLE_CAP` (10) active particles in PhoenixFlame |
| Tween overlap | AceOfShadows: natural max ~2 cards in-flight; no artificial limit needed |
| TextStyle cache | Module-level singleton styles in MagicWords; `TextMetrics` measured once per message |
| Lookup tables | `buildLookupTable` in math.ts for precomputed sin/cos used by PhoenixFlame sway |
| Atlas bake | 12 cells/frame in `update()` — avoids rAF budget violations during atlas construction |
| Draw calls | All 144 card sprites share one `RenderTexture` source → 1 draw call for the whole deck |
| Ticker cap | No `maxFPS` limit — Ticker follows native display refresh rate (60/120/144 Hz) |

---

## Build & Deploy

| Target | Command |
|---|---|
| Dev server | `npm run dev` |
| Production build | `npm run build` |
| Type-check only | `npm run typecheck` |
| Unit tests | `npm run test` |
| Lint | `npm run lint` |
| GitHub Pages | Push to `main` — CI builds and deploys via `peaceiris/actions-gh-pages` |

Set `VITE_BASE='/your-repo-name/'` in the CI environment when deploying under a GitHub project page.
