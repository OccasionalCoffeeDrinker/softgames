/**
 * @file Phoenix Flame — full feature scene.
 *
 * A fire particle system with:
 * - Hard-capped ParticlePool (PARTICLE_CAP = 10).
 * - ADD blend mode per particle sprite.
 * - Precomputed lookup tables for alpha and scale curves (in ParticlePool).
 * - Emission point sways horizontally using Math.sin(elapsed) per ADR-007.
 * - Per-particle tint gradient: yellow → orange → deep red over lifetime.
 * - Particle spawn governed by PARTICLE_SPAWN_INTERVAL_MS.
 *
 * Texture: a soft white radial circle generated via renderer.generateTexture()
 * in init(). ADD blend + tint produces the fire colour.
 */

import { BlurFilter, Container, Graphics, Text, TextStyle } from 'pixi.js';
import type { Scene } from '../../core/lifecycle/Scene';
import type { AppContext } from '../../types/index';
import { TweenManager } from '../../core/lifecycle/TweenManager';
import { Button } from '../../ui/components/Button';
import { Typography } from '../../ui/theme/Theme';
import { AppConfig } from '../../app/config/AppConfig';
import { randomRange, lerp } from '../../core/utils/math';
import { ParticlePool } from './ParticlePool';
import type { SpawnOptions } from './ParticlePool';

// ---------------------------------------------------------------------------
// Fire colour gradient  (yellow → orange → red → dark red)
// ---------------------------------------------------------------------------

/** Linearly interpolate a single 0-255 channel. */
function lerpChannel(a: number, b: number, t: number): number {
  return Math.round(a + (b - a) * t) & 0xff;
}

/** Blend between two packed hex colours. */
function lerpColor(from: number, to: number, t: number): number {
  const r = lerpChannel((from >> 16) & 0xff, (to >> 16) & 0xff, t);
  const g = lerpChannel((from >> 8) & 0xff, (to >> 8) & 0xff, t);
  const b = lerpChannel(from & 0xff, to & 0xff, t);
  return (r << 16) | (g << 8) | b;
}

const FIRE_STOPS: { at: number; color: number }[] = [
  { at: 0.0, color: 0xffffff },  // white-hot birth
  { at: 0.2, color: 0xffee44 },  // yellow
  { at: 0.5, color: 0xff8800 },  // orange
  { at: 0.8, color: 0xff2200 },  // red
  { at: 1.0, color: 0x330000 },  // dying ember
];

function fireColor(t: number): number {
  for (let i = 1; i < FIRE_STOPS.length; i++) {
    const prev = FIRE_STOPS[i - 1];
    const curr = FIRE_STOPS[i];
    if (prev === undefined || curr === undefined) continue;
    if (t <= curr.at) {
      const local = (t - prev.at) / (curr.at - prev.at);
      return lerpColor(prev.color, curr.color, local);
    }
  }
  return FIRE_STOPS[FIRE_STOPS.length - 1]?.color ?? 0x000000;
}

// ---------------------------------------------------------------------------
// Ember type (separate from 10-cap pool — tiny flying sparks)
// ---------------------------------------------------------------------------
interface Ember {
  g: Graphics;
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  age: number;
}

const EMBER_SPAWN_INTERVAL_MS = 280;
const MAX_EMBERS = 5;
const EMBER_GRAVITY = 0.00025; // px / ms²

// Glow ring outer radius (px)
const GLOW_R = 130;

// Particle texture radius (px)
const TEX_R = 48;

// ---------------------------------------------------------------------------
// PhoenixFlameScene
// ---------------------------------------------------------------------------

export class PhoenixFlameScene implements Scene {
  public readonly id = 'phoenix-flame' as const;
  public readonly root: Container;
  public readonly tweens: TweenManager;

  private _ctx!: AppContext;

  private _bg!: Graphics;
  private _glowRing!: Graphics;
  private _particleLayer!: Container;
  private _emberLayer!: Container;
  private _pool!: ParticlePool;
  private _backBtn!: Button;
  private _statsLabel!: Text;

  private _width = 800;
  private _height = 600;

  /** Reference to the layer blur — strength is pulsated in update() for heat-shimmer. */
  private _blur!: BlurFilter;

  /** Elapsed ms since scene entered — drives the sway. */
  private _elapsed = 0;
  /** Accumulator for the spawn timer. */
  private _spawnAcc = 0;
  private _emberSpawnAcc = 0;
  private _embers: Ember[] = [];
  /** Cycles through hero particle types (0–2). */
  private _spawnCount = 0;

  public constructor() {
    this.root = new Container();
    this.tweens = new TweenManager();
  }

  // ---------------------------------------------------------------------------
  // Lifecycle
  // ---------------------------------------------------------------------------

  public init(ctx: AppContext): void {
    this._ctx = ctx;

    // Background
    this._bg = new Graphics();
    this.root.addChild(this._bg);

    // --- Glow ring (pulsating halo below the flame) ---
    this._glowRing = new Graphics();
    for (let i = 8; i >= 0; i--) {
      const r = GLOW_R * (i / 8);
      const a = (1 - i / 8) * 0.18;
      this._glowRing.ellipse(0, 0, r * 1.6, r * 0.5);
      this._glowRing.fill({ color: 0xff4400, alpha: a });
    }
    this.root.addChild(this._glowRing);

    // --- Generate pointed teardrop particle texture ---
    // Quad-curve "tear": wide at base, narrows to a point at top.
    // Per-layer sinusoidal notch offset breaks bilateral symmetry —
    // gives a "split tongue" look and avoids the clean svećа/torch silhouette.
    const TW = TEX_R;       // half-width of base
    const TH = TEX_R * 2.2; // full height of tear
    const layers = 10;
    const g = new Graphics();
    for (let step = 0; step < layers; step++) {
      const ratio = 1 - step / layers;
      const rx = TW * ratio;
      const ry = TH * ratio;
      const alpha = lerp(0, 0.92, ratio);
      // Asymmetric notch: cx shifts slightly per layer so the outline is not perfectly smooth.
      const notch = Math.sin(step * 1.3) * 2.5 * ratio;
      const cx = TW + notch;
      const cy = TH;
      // Quadratic teardrop: tips to a point at top, round at bottom
      g.moveTo(cx, cy - ry);
      g.quadraticCurveTo(cx + rx, cy - ry * 0.15, cx, cy + ry * 0.12);
      g.quadraticCurveTo(cx - rx, cy - ry * 0.15, cx, cy - ry);
      g.fill({ color: 0xffffff, alpha });
    }
    const particleTex = ctx.app.renderer.generateTexture(g);
    g.destroy();

    // --- Particle layer + pool ---
    this._particleLayer = new Container();
    // quality: 1 = 2 GPU passes (H+V) instead of 4 — avoids 101ms RAF violations.
    this._blur = new BlurFilter({ strength: 2.0, quality: 1 });
    this._particleLayer.filters = [this._blur];
    this.root.addChild(this._particleLayer);
    this._pool = new ParticlePool(particleTex, this._particleLayer);

    // --- Ember layer (above particles for crisp sparks) ---
    this._emberLayer = new Container();
    this.root.addChild(this._emberLayer);

    // --- Stats label ---
    this._statsLabel = new Text({
      text: `Particles: 0 / ${AppConfig.PARTICLE_CAP}`,
      style: new TextStyle({
        fontFamily: Typography.FONT_FAMILY_MONO,
        fontSize: Typography.SIZE_SM,
        fill: 0xaaaaaa,
      }),
    });
    this._statsLabel.anchor.set(0.5, 0);
    this.root.addChild(this._statsLabel);

    // --- Back button ---
    this._backBtn = new Button({
      label: '← Back to Menu',
      onClick: () => {
        void import('../../scenes/MenuScene').then(({ MenuScene }) => {
          this._ctx.sceneManager.go(new MenuScene());
        });
      },
    });
    this.root.addChild(this._backBtn.view);
  }

  public enter(): void {
    this._elapsed = 0;
    this._spawnAcc = 0;
    this._emberSpawnAcc = 0;
    this._spawnCount = 0;
  }

  public update(dt: number): void {
    this._elapsed += dt;
    this._spawnAcc += dt;

    // Spawn timer
    if (this._spawnAcc >= AppConfig.PARTICLE_SPAWN_INTERVAL_MS) {
      this._spawnAcc -= AppConfig.PARTICLE_SPAWN_INTERVAL_MS;
      this._spawnParticle();
    }

    // Advance pool; pass the fire colour function for per-particle tinting.
    this._pool.update(dt, fireColor);

    // Ember system.
    this._emberSpawnAcc += dt;
    if (this._emberSpawnAcc >= EMBER_SPAWN_INTERVAL_MS && this._embers.length < MAX_EMBERS) {
      this._emberSpawnAcc -= EMBER_SPAWN_INTERVAL_MS;
      this._spawnEmber();
    }
    this._updateEmbers(dt);

    // Glow ring pulse.
    const sinPulse = Math.sin(this._elapsed * 0.003);
    this._glowRing.alpha = 0.6 + sinPulse * 0.2;
    this._glowRing.scale.set(1 + sinPulse * 0.05, 1 + sinPulse * 0.04);

    // Heat-shimmer: gently pulse blur strength (1.8–2.4) to make air "breathe".
    this._blur.strength = 1.8 + 0.6 * (0.5 + 0.5 * Math.sin(this._elapsed * 0.006));

    // Update stats
    this._statsLabel.text = `Particles: ${this._pool.activeCount} / ${AppConfig.PARTICLE_CAP}`;
  }

  public resize(width: number, height: number): void {
    this._width = width;
    this._height = height;
    this._layout();
  }

  public exit(): void {
    this._pool.killAll();
    this.tweens.killAll();
    for (const e of this._embers) {
      this._emberLayer.removeChild(e.g);
      e.g.destroy();
    }
    this._embers = [];
  }

  public destroy(): void {
    this._backBtn.destroy();
    this.root.destroy({ children: true });
  }

  // ---------------------------------------------------------------------------
  // Particle spawn
  // ---------------------------------------------------------------------------

  private _spawnParticle(): void {
    const cx = this._width / 2;
    const cy = this._height * 0.65;

    // Wind sway: shifts the whole emission centre subtly.
    const sway = Math.sin(this._elapsed * 0.0012) * 18;

    // --- Hero type selection (cycles 0‒9, giving 3 types weighted) ---
    // 0,1,2 → core tongue  (30%) — narrow, straight, fast, long life
    // 3,4,5,6,7,8 → body    (60%) — medium, curling, moderate speed
    // 9 → lick              (10%) — wide, strong curl, short life
    const slot = this._spawnCount % 10;
    this._spawnCount++;

    let ex: number, ey: number, vx: number, vy: number, life: number;
    let opts: SpawnOptions;

    if (slot <= 2) {
      // CORE TONGUE: tight base, fast rise, holds the central column
      ex = cx + sway + randomRange(-6, 6);
      ey = cy + randomRange(-4, 4);
      vx = randomRange(-0.006, 0.006);
      vy = randomRange(-0.40, -0.55);
      life = randomRange(750, 950);
      opts = { curlAmp: 6, curlFreq: 0.003, curlPhase: Math.random() * Math.PI * 2, drag: 0.006, aspectX: 0.30, stretchMul: 1.05, alphaMul: 1.25 };
    } else if (slot <= 8) {
      // BODY FLAME: glow layer, not dominant shape — narrower + more transparent.
      // Core carries the form; body adds warm volume around it.
      ex = cx + sway + randomRange(-18, 18);
      ey = cy + randomRange(-6, 6);
      vx = randomRange(-0.015, 0.015);
      vy = randomRange(-0.22, -0.36);
      life = randomRange(600, 900);
      opts = { curlAmp: 18, curlFreq: 0.0024, curlPhase: Math.random() * Math.PI * 2, drag: 0.011, aspectX: 0.50, stretchMul: 0.90, alphaMul: 0.80 };
    } else {
      // LICK: short-lived burst that pops off to the side and breaks up
      const side = Math.random() < 0.5 ? 1 : -1;
      ex = cx + sway + side * randomRange(18, 32);
      ey = cy + randomRange(-8, 8);
      vx = side * randomRange(0.012, 0.025);
      vy = randomRange(-0.18, -0.32);
      life = randomRange(300, 550);
      opts = { curlAmp: 28, curlFreq: 0.005, curlPhase: Math.random() * Math.PI * 2, drag: 0.014, aspectX: 0.65, stretchMul: 1.15, alphaMul: 0.85 };
    }

    this._pool.spawn(ex, ey, vx, vy, life, opts);
  }

  // ---------------------------------------------------------------------------
  // Ember helpers
  // ---------------------------------------------------------------------------

  private _spawnEmber(): void {
    const cx = this._width / 2 + Math.sin(this._elapsed * 0.0012) * 18;
    const cy = this._height * 0.65;
    const g = new Graphics();
    g.circle(0, 0, 2.5);
    g.fill({ color: 0xffff88 });
    this._emberLayer.addChild(g);
    const side = Math.random() < 0.5 ? 1 : -1;
    this._embers.push({
      g,
      x: cx + randomRange(-30, 30),
      y: cy + randomRange(-8, 8),
      vx: side * randomRange(0.18, 0.45),
      vy: randomRange(-0.28, -0.14),
      life: randomRange(800, 1600),
      age: 0,
    });
  }

  private _updateEmbers(dt: number): void {
    for (let i = this._embers.length - 1; i >= 0; i--) {
      const e = this._embers[i];
      if (!e) continue;
      e.age += dt;
      e.vy += EMBER_GRAVITY * dt;
      e.x += e.vx * dt;
      e.y += e.vy * dt;
      e.g.x = e.x;
      e.g.y = e.y;
      e.g.alpha = Math.max(0, 1 - e.age / e.life);
      if (e.age >= e.life) {
        this._emberLayer.removeChild(e.g);
        e.g.destroy();
        this._embers.splice(i, 1);
      }
    }
  }

  // ---------------------------------------------------------------------------
  // ---------------------------------------------------------------------------

  private _layout(): void {
    this._bg.clear();
    this._bg.rect(0, 0, this._width, this._height);
    this._bg.fill({ color: 0x050508 }); // near-black — maximises ADD blend contrast

    this._glowRing.x = this._width / 2;
    this._glowRing.y = this._height * 0.65 + 20;

    this._statsLabel.x = this._width / 2;
    this._statsLabel.y = 14;

    this._backBtn.x = this._width / 2 - 140;
    this._backBtn.y = this._height - 72;
  }
}
