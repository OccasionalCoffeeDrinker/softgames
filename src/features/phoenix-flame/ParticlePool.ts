/**
 * @file Phoenix Flame — particle pool.
 *
 * Manages a fixed-size pool of {@link BlazeLike} particle sprites.
 * The hard cap (AppConfig.PARTICLE_CAP = 10) is enforced at spawn time:
 * if all slots are occupied the spawn call is a no-op.
 *
 * Lookup tables for the alpha and scale curves are precomputed once at
 * construction time using `buildLookupTable` from the math utilities.
 * This avoids per-frame Math.pow/Math.sin calls per particle.
 */

import { Container, Sprite, Texture } from 'pixi.js';
import { AppConfig } from '@app/config/AppConfig';
import { buildLookupTable, sampleLookup, lerp } from '@core/utils/math';

// ---------------------------------------------------------------------------
// Internal particle state
// ---------------------------------------------------------------------------

interface Particle {
  sprite: Sprite;
  vx: number;      // horizontal velocity in px/ms (linear component)
  vy: number;      // vertical velocity in px/ms (negative = upward)
  life: number;    // elapsed lifetime in ms
  maxLife: number; // total lifetime in ms
  active: boolean;
  // Curl motion (sinusoidal horizontal oscillation over lifetime)
  birthX: number;  // world x at spawn — curl is relative to this
  curlAmp: number; // oscillation amplitude in px
  curlFreq: number;// oscillation frequency (rad/ms)
  curlPhase: number;// initial phase offset
  // Turbulence (random-walk horizontal jitter — breaks procedural look)
  noiseX: number;
  // Physics
  drag: number;    // velocity damping per 16ms tick (0 = none, 0.02 = gentle)
  // Visual
  aspectX: number;    // scaleX multiplier (< 1 → narrow tongue, 1 → round)
  stretchMul: number; // per-type Y-stretch multiplier (1 = normal)
  alphaMul: number;   // per-type alpha multiplier (> 1 = brighter core)
}

/** Optional per-spawn configuration. */
export interface SpawnOptions {
  curlAmp?: number;
  curlFreq?: number;
  curlPhase?: number;
  drag?: number;
  /** scaleX multiplier relative to scale curve — use <1 for narrow tongues. */
  aspectX?: number;
  /** Y-stretch multiplier: 1.05 core (holds column), 0.95 body, 1.15 lick. */
  stretchMul?: number;
  /** Alpha multiplier: 1.25 core (bright), 1.0 body, 0.85 lick (transparent). */
  alphaMul?: number;
}

// ---------------------------------------------------------------------------
// Curve lookup tables (computed once, shared across all particles)
// ---------------------------------------------------------------------------

/**
 * Alpha envelope: quick ramp, then fade that accelerates past 55%.
 * Cuts the lingering "red curtain" caused by slow ADD-blended tails.
 */
const ALPHA_TABLE = buildLookupTable(AppConfig.PARTICLE_LOOKUP_STEPS, (t) => {
  if (t < 0.10) return t / 0.10;                                // fast ramp-up
  if (t < 0.55) return lerp(1.0, 0.75, (t - 0.10) / 0.45);    // gentle fade 1→0.75
  return lerp(0.75, 0.0, (t - 0.55) / 0.45);                   // quick fade 0.75→0
});

/**
 * Scale curve: smaller initial puff, modest expansion, earlier dissipation.
 * Keeps flame shorter and prevents the "torch" silhouette.
 */
const SCALE_TABLE = buildLookupTable(AppConfig.PARTICLE_LOOKUP_STEPS, (t) => {
  if (t < 0.12) return lerp(0.20, 1.05, t / 0.12);             // small puff
  if (t < 0.60) return lerp(1.05, 1.20, (t - 0.12) / 0.48);   // gentle expansion
  return lerp(1.20, 0.35, (t - 0.60) / 0.40);                  // early dissipation
});

// ---------------------------------------------------------------------------
// ParticlePool
// ---------------------------------------------------------------------------

export class ParticlePool {
  private readonly _particles: Particle[];
  private readonly _layer: Container;

  public constructor(texture: Texture, layer: Container) {
    this._layer = layer;

    this._particles = Array.from({ length: AppConfig.PARTICLE_CAP }, () => {
      const sprite = new Sprite(texture);
      sprite.anchor.set(0.5, 0.9); // base-anchored: particle grows upward from spawn point
      sprite.blendMode = 'add';
      sprite.visible = false;
      layer.addChild(sprite);
      return {
        sprite,
        vx: 0, vy: 0, life: 0, maxLife: 0, active: false,
        birthX: 0, curlAmp: 0, curlFreq: 0, curlPhase: 0,
        noiseX: 0,
        drag: 0, aspectX: 1, stretchMul: 1, alphaMul: 1,
      };
    });
  }

  // ---------------------------------------------------------------------------
  // Public API
  // ---------------------------------------------------------------------------

  /** Number of currently active particles. */
  public get activeCount(): number {
    return this._particles.filter((p) => p.active).length;
  }

  /**
   * Attempt to spawn a particle. No-op if all slots are occupied.
   *
   * @param x       World x of the emission point.
   * @param y       World y of the emission point.
   * @param vx      Horizontal velocity in px/ms.
   * @param vy      Vertical velocity in px/ms (negative = upward).
   * @param maxLife Total lifetime in ms.
   */
  public spawn(x: number, y: number, vx: number, vy: number, maxLife: number, opts?: SpawnOptions): void {
    const slot = this._particles.find((p) => !p.active);
    if (slot === undefined) return; // cap reached — skip

    slot.sprite.x = x;
    slot.sprite.y = y;
    slot.vx = vx;
    slot.vy = vy;
    slot.life = 0;
    slot.maxLife = maxLife;
    slot.active = true;
    slot.sprite.visible = true;
    slot.birthX = x;
    slot.noiseX = 0;
    slot.curlAmp   = opts?.curlAmp    ?? 0;
    slot.curlFreq  = opts?.curlFreq   ?? 0;
    slot.curlPhase = opts?.curlPhase  ?? 0;
    slot.drag      = opts?.drag       ?? 0;
    slot.aspectX   = opts?.aspectX    ?? 1;
    slot.stretchMul = opts?.stretchMul ?? 1;
    slot.alphaMul   = opts?.alphaMul   ?? 1;
  }

  /**
   * Advance all active particles by `dt` milliseconds.
   *
   * Each particle's position, alpha and scale are updated via
   * the precomputed lookup tables —zero branching beyond the alive check.
   *
   * @param dt      Delta time in milliseconds.
   * @param getTint Optional function mapping normalised lifetime [0,1] to a hex tint colour.
   */
  public update(dt: number, getTint?: (t: number) => number): void {
    for (const p of this._particles) {
      if (!p.active) continue;

      p.life += dt;
      if (p.life >= p.maxLife) {
        p.active = false;
        p.sprite.visible = false;
        continue;
      }

      const t = p.life / p.maxLife; // normalised [0, 1)

      // --- Position ---
      // X: birthX + linear drift + two-wave curl + organic random-walk turbulence.
      // Turbulence amplitude grows toward the tip (high t), simulating convection.
      const amp = p.curlAmp * (0.15 + 0.85 * t);
      const w1 = Math.sin(p.life * p.curlFreq + p.curlPhase);
      const w2 = Math.sin(p.life * (p.curlFreq * 0.37) + p.curlPhase * 1.7);
      const curl = (w1 * 0.7 + w2 * 0.3) * amp;
      // Random-walk jitter: stronger near the tip where flame breaks up.
      p.noiseX += (Math.random() - 0.5) * (0.18 + 0.55 * t) * dt;
      p.noiseX *= 0.92; // damping prevents runaway drift
      p.sprite.x = p.birthX + p.vx * p.life + curl + p.noiseX;

      // Column glue: convection pulls drifted sprites back toward the central
      // column — stronger near the base, fades toward the tip.
      const pull = (p.birthX - p.sprite.x) * (0.018 * (1 - t)) * (dt / 16);
      p.sprite.x += pull;

      // Y: buoyancy (extra upward push in lower half) + drag on both axes
      const buoy = -0.00035 * (1 - t);
      p.vy += buoy * dt;
      // Linear approximation of (1-drag)^(dt/16) — valid for drag ≤ 0.02 and
      // dt near 16ms. Avoids Math.pow per particle per frame.
      const damp = 1 - p.drag * (dt / 16);
      p.vx *= damp;
      p.vy *= damp;
      p.sprite.y += p.vy * dt;

      // --- Visual ---
      p.sprite.alpha = Math.min(1, sampleLookup(ALPHA_TABLE, t) * p.alphaMul);
      const base = sampleLookup(SCALE_TABLE, t);

      // Velocity-based rotation + stretch — elongates in travel direction.
      // stretchMul lets core hold a longer column vs body/lick which puff more.
      const speed = Math.sqrt(p.vx * p.vx + p.vy * p.vy);
      p.sprite.rotation = Math.atan2(p.vy, p.vx) + Math.PI / 2;
      const stretchY = (1 + Math.min(0.55, speed * 1.4)) * p.stretchMul;
      const squashX  = 1 - Math.min(0.22, speed * 0.45);
      // Tip breakup: rapid scale chop only in the upper portion (t > 0.6).
      // Makes the flame tip "nervously" flicker instead of dissolving smoothly.
      const chop = t < 0.6 ? 1 : (0.82 + 0.18 * Math.sin(p.life * 0.02 + p.curlPhase * 3.0));
      p.sprite.scale.set(base * p.aspectX * squashX, base * stretchY * chop);

      if (getTint !== undefined) {
        p.sprite.tint = getTint(t);
      }
    }
  }

  /**
   * Immediately deactivate all particles.
   * Called by the scene's `exit()` to ensure clean teardown.
   */
  public killAll(): void {
    for (const p of this._particles) {
      p.active = false;
      p.sprite.visible = false;
    }
  }

  public destroy(): void {
    this.killAll();
    this._layer.destroy({ children: true });
  }
}
