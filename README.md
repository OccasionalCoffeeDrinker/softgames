# Softgames HTML5 Game Developer Assignment

A production-quality PixiJS v8 + TypeScript project demonstrating three interactive demos for the Softgames Senior HTML5 Game Developer position.

[![CI](https://github.com/OccasionalCoffeeDrinker/softgames/actions/workflows/ci.yml/badge.svg)](https://github.com/OccasionalCoffeeDrinker/softgames/actions/workflows/ci.yml)

**Live demo:** https://OccasionalCoffeeDrinker.github.io/softgames/

---

## Tech Stack

| Layer | Choice |
|---|---|
| Renderer | [PixiJS v8](https://pixijs.com/) (WebGL / WebGPU) |
| Language | TypeScript 5.7 (strict + exactOptionalPropertyTypes) |
| Bundler | Vite 6 |
| Tests | Vitest 3 |
| Linter | ESLint 9 (flat config) |
| Formatter | Prettier |
| CI/CD | GitHub Actions → GitHub Pages |

---

## Getting Started

```bash
# Install dependencies
npm install

# Start development server (http://localhost:3000)
npm run dev

# Type-check + production build → dist/
npm run build

# Run unit tests (once)
npm run test

# Lint
npm run lint

# Format
npm run format
```

---

## Project Structure

```
src/
├── app/
│   ├── bootstrap/        # Application entry point & PixiJS init
│   └── config/           # Global constants (AppConfig)
├── core/
│   ├── assets/           # Tagged asset management
│   ├── diagnostics/      # FPS meter & debug overlay
│   ├── lifecycle/        # Scene, SceneManager, TweenManager
│   ├── rendering/        # Debounced resize manager
│   └── utils/            # math.ts, debug.ts
├── features/
│   ├── ace-of-shadows/   # Task 1 — card animation
│   ├── magic-words/      # Task 2 — API-driven chat feed
│   └── phoenix-flame/    # Task 3 — particle fire
├── scenes/               # MenuScene (navigation hub)
├── types/                # Shared TypeScript types
└── ui/
    ├── components/       # Button
    └── theme/            # Design tokens
```

---

## Demos

### Task 1 — Ace of Shadows

144 cards distributed across 6 stacks in a 3×2 grid. Every second one card is picked from a random non-empty stack and animated in a smooth parabolic arc to a random destination stack. An `isMoving` guard prevents the same card from being grabbed twice mid-flight.

Card faces are rendered as real playing cards (suit symbol + value, corner indicators top-left and bottom-right, pip layout for 2–10, face-card label for J/Q/K, oversized symbol for A). All 144 faces are baked into a single `RenderTexture` atlas (12 × 12 grid) incrementally — 12 cells per frame inside `update()` — to avoid rAF budget violations. A "Preparing cards…" overlay is shown during baking; card movement is gated until the atlas is complete.

- **144 cards**, 24 per stack at start
- **1 s** trigger interval, **2 s** arc animation (ease-in-out)
- Live moves counter
- Single-atlas rendering — all 144 sprites share one `RenderTexture`, so Pixi batches them into one draw call
- Ticker runs at native display refresh rate (no `maxFPS` cap)
- Fullscreen toggle button (top-right corner, always on top of canvas)

### Task 2 — Magic Words

Fetches a dialogue from the Softgames API and renders it as an animated chat feed. Each message is a `BubbleView` containing an avatar and an inline-layouted text + emoji line (word-wrapped).

- Real API call with `AbortController` timeout guard
- Custom `tokenize()` splits `"Hello {emoji}"` into text/emoji tokens
- Unknown emoji tokens (e.g. `{win}`, `{affirmative}`) are auto-fetched from DiceBear as a fallback; unresolvable tokens render as `[name]`
- Inline word-wrap layout engine
- Avatar images loaded via native `Image` → `Texture.from()` (works with extensionless URLs from DiceBear)
- Auto-scroll with staggered reveal (1.5 s between messages)

### Task 3 — Phoenix Flame

Additive-blend particle fire effect built on a hard-capped pool of 10 sprites. Particles use pre-computed lookup tables (LUT) for alpha and scale curves, keeping per-frame math to a minimum.

- **10 particle cap** via `ParticlePool`
- `blendMode = 'add'` (PixiJS v8 string form)
- Fire colour gradient white → yellow → orange → red
- Sine-wave horizontal sway; spawn rate driven by `AppConfig`

---

## Architecture

See [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) for a full breakdown of the scene lifecycle, asset ownership model, and tween system.

Design decisions and trade-offs are documented in [docs/DECISIONS.md](docs/DECISIONS.md).

---

## Testing

```
src/
├── core/utils/math.test.ts                              (21 tests)
├── features/ace-of-shadows/models/CardStackModel.test.ts (11 tests)
├── features/magic-words/tokenizer.test.ts               (10 tests)
└── features/phoenix-flame/ParticlePool.test.ts           ( 7 tests)
                                                   Total: 49 tests
```

All tests run in the `node` environment (pure-logic modules — no DOM required).

---

## Deployment

The `ci.yml` workflow runs on every push to `main`:

1. `npm ci`
2. `npm run lint`
3. `npm run test -- --run`
4. `npm run build`
5. Deploy `dist/` to GitHub Pages

To activate deployment, enable **Pages** in your repository settings and set the source to the `gh-pages` branch (or `Actions` if using the workflow's `actions/deploy-pages` step).
