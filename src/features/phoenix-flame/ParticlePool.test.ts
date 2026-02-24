/**
 * @file Tests for ParticlePool.
 *
 * Uses a minimal Container/Sprite mock so no real canvas is required.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

// ---------------------------------------------------------------------------
// Hoisted mock factories — must be defined via vi.hoisted() so that vi.mock()
// factory callbacks (which are hoisted by Vitest) can safely reference them.
// ---------------------------------------------------------------------------

const { MockSprite, MockContainer, MockTexture } = vi.hoisted(() => {
  class _MockSprite {
    x = 0;
    y = 0;
    alpha = 1;
    tint = 0xffffff;
    visible = false;
    anchor = { set: vi.fn() };
    scale = { set: vi.fn() };
    blendMode = 'normal';
  }

  class _MockContainer {
    children: _MockSprite[] = [];
    addChild(child: _MockSprite): void { this.children.push(child); }
    destroy(_opts?: unknown): void { /* no-op */ }
  }

  class _MockTexture { readonly _brand = 'MockTexture'; }

  return { MockSprite: _MockSprite, MockContainer: _MockContainer, MockTexture: _MockTexture };
});

// Mock PixiJS modules *before* importing ParticlePool so it receives the mocks.
vi.mock('pixi.js', () => ({
  Sprite: MockSprite,
  Container: MockContainer,
  Texture: { EMPTY: new MockTexture() },
}));

// Mock path-alias imports used inside ParticlePool.
vi.mock('@app/config/AppConfig', () => ({
  AppConfig: {
    PARTICLE_CAP: 10,
    PARTICLE_LOOKUP_STEPS: 64,
    PARTICLE_LIFETIME_MIN_MS: 800,
    PARTICLE_LIFETIME_MAX_MS: 1600,
    PARTICLE_SPAWN_INTERVAL_MS: 100,
  },
}));

vi.mock('@core/utils/math', () => ({
  buildLookupTable: (_steps: number, fn: (t: number) => number) =>
    Array.from({ length: 64 }, (_, i) => fn(i / 63)),
  sampleLookup: (table: number[], t: number) =>
    table[Math.round(t * (table.length - 1))] ?? 1,
  lerp: (a: number, b: number, t: number) => a + (b - a) * t,
}));

import { ParticlePool } from './ParticlePool';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makePool(): { pool: ParticlePool; layer: InstanceType<typeof MockContainer> } {
  const layer = new MockContainer();
  const tex = new MockTexture();
  const pool = new ParticlePool(tex as never, layer as never);
  return { pool, layer };
}

function spawnN(pool: ParticlePool, n: number): void {
  for (let i = 0; i < n; i++) {
    pool.spawn(0, 0, 0, -0.1, 1000);
  }
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('ParticlePool', () => {
  let pool: ParticlePool;

  beforeEach(() => {
    ({ pool } = makePool());
  });

  it('starts with 0 active particles', () => {
    expect(pool.activeCount).toBe(0);
  });

  it('increments activeCount on spawn', () => {
    spawnN(pool, 3);
    expect(pool.activeCount).toBe(3);
  });

  it('enforces hard cap of 10 — 11th spawn is a no-op', () => {
    spawnN(pool, 11);
    // Pool only has 10 slots — 11th call must not exceed the cap.
    expect(pool.activeCount).toBe(10);
  });

  it('recycles slots after update advances particle past lifetime', () => {
    spawnN(pool, 10);
    expect(pool.activeCount).toBe(10);
    // Advance past the maxLife (1000ms) for all particles.
    pool.update(1100, undefined);
    expect(pool.activeCount).toBe(0);
    // Now we should be able to spawn again.
    pool.spawn(0, 0, 0, -0.1, 1000);
    expect(pool.activeCount).toBe(1);
  });

  it('killAll deactivates all particles immediately', () => {
    spawnN(pool, 7);
    pool.killAll();
    expect(pool.activeCount).toBe(0);
  });

  it('update moves particle position', () => {
    pool.spawn(100, 100, 0.5, -0.1, 1000);
    pool.update(100, undefined);
    // After 100ms at vx=0.5 the linear component puts x at 150.
    // Random-walk turbulence (noiseX) adds up to ~±12px, so we accept ±20.
    const sprite = (pool as unknown as { _particles: { sprite: InstanceType<typeof MockSprite>; active: boolean }[] })
      ._particles.find((p) => p.active)?.sprite;
    expect(sprite?.x).toBeGreaterThan(130);
    expect(sprite?.x).toBeLessThan(170);
  });

  it('calls getTint with normalised progress', () => {
    const getTint = vi.fn(() => 0xff0000);
    pool.spawn(0, 0, 0, -0.1, 1000);
    pool.update(500, getTint);
    expect(getTint).toHaveBeenCalledOnce();
    // Progress at 500ms / 1000ms = 0.5.
    expect(getTint).toHaveBeenCalledWith(expect.closeTo(0.5, 1));
  });
});
