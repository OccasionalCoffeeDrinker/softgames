/**
 * @file Main menu scene.
 *
 * Displays a centred title and three navigation buttons — one per task.
 * Includes animated floating particles in the background, a staggered
 * button entrance, and a title scale-in effect.
 */

import { Container, Graphics, Text, TextStyle } from 'pixi.js';
import type { Scene } from '../core/lifecycle/Scene';
import type { AppContext } from '../types/index';
import { TweenManager, easeOutQuad } from '../core/lifecycle/TweenManager';
import { Button } from '../ui/components/Button';
import { Colors, Typography, Spacing } from '../ui/theme/Theme';
import { AceOfShadowsScene } from '../features/ace-of-shadows/AceOfShadowsScene';
import { MagicWordsScene } from '../features/magic-words/MagicWordsScene';
import { PhoenixFlameScene } from '../features/phoenix-flame/PhoenixFlameScene';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const BUTTON_WIDTH = 300;
const BUTTON_HEIGHT = 60;
const BUTTON_GAP = Spacing.LG;
const MAX_DOTS = 14;
const APP_VERSION = 'v1.0.0';

// ---------------------------------------------------------------------------
// Floating particle type
// ---------------------------------------------------------------------------

interface FloatingDot {
  g: Graphics;
  x: number;
  y: number;
  vy: number;       // pixels / ms (upward, negative)
  vx: number;       // horizontal drift
  r: number;        // radius
  lifetime: number; // ms
  age: number;      // ms elapsed
}

// ---------------------------------------------------------------------------
// MenuScene
// ---------------------------------------------------------------------------

export class MenuScene implements Scene {
  public readonly id = 'menu' as const;
  public readonly root: Container;
  public readonly tweens: TweenManager;

  private _ctx!: AppContext;
  private _width = 800;
  private _height = 600;

  private _bg!: Graphics;
  private _particleLayer!: Container;
  private _title!: Text;
  private _subtitle!: Text;
  private _versionLabel!: Text;
  private _buttons: Button[] = [];
  private _dots: FloatingDot[] = [];

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

    // Particle layer — behind title/buttons
    this._particleLayer = new Container();
    this.root.addChild(this._particleLayer);

    // Title
    const titleStyle = new TextStyle({
      fontFamily: Typography.FONT_FAMILY_PRIMARY,
      fontSize: Typography.SIZE_TITLE,
      fontWeight: 'bold',
      fill: Colors.ACCENT,
      align: 'center',
    });
    this._title = new Text({ text: 'SOFTGAMES', style: titleStyle });
    this._title.anchor.set(0.5);
    this._title.alpha = 0;
    this.root.addChild(this._title);

    // Subtitle
    const subtitleStyle = new TextStyle({
      fontFamily: Typography.FONT_FAMILY_PRIMARY,
      fontSize: Typography.SIZE_SM,
      fill: 0xaaaaaa,
      align: 'center',
    });
    this._subtitle = new Text({ text: 'Select a demo', style: subtitleStyle });
    this._subtitle.anchor.set(0.5);
    this._subtitle.alpha = 0;
    this.root.addChild(this._subtitle);

    // Navigation buttons (start invisible for stagger-in)
    const buttonDefs: { label: string; factory: () => Scene }[] = [
      { label: 'Ace of Shadows', factory: () => new AceOfShadowsScene() },
      { label: 'Magic Words',    factory: () => new MagicWordsScene()    },
      { label: 'Phoenix Flame',  factory: () => new PhoenixFlameScene()  },
    ];

    for (const def of buttonDefs) {
      const btn = new Button({
        label: def.label,
        width: BUTTON_WIDTH,
        height: BUTTON_HEIGHT,
        onClick: () => { this._ctx.sceneManager.go(def.factory()); },
      });
      btn.view.alpha = 0;
      this._buttons.push(btn);
      this.root.addChild(btn.view);
    }

    // Version label — bottom-right corner
    this._versionLabel = new Text({
      text: APP_VERSION,
      style: new TextStyle({
        fontFamily: 'monospace',
        fontSize: 11,
        fill: 0x444466,
      }),
    });
    this._versionLabel.anchor.set(1, 1);
    this.root.addChild(this._versionLabel);
  }

  public enter(): void {
    // Kill any tweens from a previous visit.
    this.tweens.killAll();

    // Reset visible state (handles re-entering from another scene).
    this._title.alpha = 0;
    this._title.scale.set(1.1);
    this._subtitle.alpha = 0;
    for (const btn of this._buttons) btn.view.alpha = 0;

    // Title: scale 1.1 → 1.0 + fade in.
    this.tweens.add({
      duration: 600,
      easing: easeOutQuad,
      onUpdate: (p) => {
        this._title.alpha = p;
        this._title.scale.set(1.1 - 0.1 * p);
      },
      onComplete: () => { this._title.alpha = 1; this._title.scale.set(1); },
    });

    // Subtitle: fade in with short delay.
    this.tweens.add({
      duration: 500,
      delay: 200,
      easing: easeOutQuad,
      onUpdate: (p) => { this._subtitle.alpha = p; },
      onComplete: () => { this._subtitle.alpha = 1; },
    });

    // Buttons: staggered fade in.
    for (let i = 0; i < this._buttons.length; i++) {
      const btn = this._buttons[i];
      if (!btn) continue;
      this.tweens.add({
        duration: 400,
        delay: 400 + i * 140,
        easing: easeOutQuad,
        onUpdate: (p) => { btn.view.alpha = p; },
        onComplete: () => { btn.view.alpha = 1; },
      });
    }

    // Spawn floating background dots.
    this._spawnInitialDots();
  }

  public update(dt: number): void {
    this.tweens.update(dt);
    this._updateDots(dt);
  }

  public resize(width: number, height: number): void {
    this._width = width;
    this._height = height;
    this._layout();
  }

  public exit(): void {
    this.tweens.killAll();
    this._clearDots();
  }

  public destroy(): void {
    this._clearDots();
    for (const btn of this._buttons) btn.destroy();
    this._buttons = [];
    this.root.destroy({ children: true });
  }

  // ---------------------------------------------------------------------------
  // Private helpers
  // ---------------------------------------------------------------------------

  private _layout(): void {
    const cx = this._width / 2;
    const cy = this._height / 2;

    this._bg.clear();
    this._bg.rect(0, 0, this._width, this._height);
    this._bg.fill({ color: Colors.BACKGROUND });

    this._title.x = cx;
    this._title.y = cy - 160;

    this._subtitle.x = cx;
    this._subtitle.y = cy - 120;

    const totalH =
      this._buttons.length * BUTTON_HEIGHT +
      (this._buttons.length - 1) * BUTTON_GAP;
    let startY = cy - totalH / 2 + 50;

    for (const btn of this._buttons) {
      btn.x = cx - BUTTON_WIDTH / 2;
      btn.y = startY;
      startY += BUTTON_HEIGHT + BUTTON_GAP;
    }

    // Version label — 10px from bottom-right corner.
    this._versionLabel.x = this._width - 10;
    this._versionLabel.y = this._height - 10;
  }

  // ---------------------------------------------------------------------------
  // Particle dots
  // ---------------------------------------------------------------------------

  private _makeDot(spreadY = false): FloatingDot {
    const r = 1.5 + Math.random() * 3;
    const g = new Graphics();
    g.circle(0, 0, r);
    g.fill({ color: Colors.ACCENT, alpha: 0.15 + Math.random() * 0.2 });
    this._particleLayer.addChild(g);

    const x = Math.random() * this._width;
    const y = spreadY ? Math.random() * this._height : this._height + r;

    return {
      g,
      x,
      y,
      vy: -(0.015 + Math.random() * 0.025), // 15–40 px/s upward
      vx: (Math.random() - 0.5) * 0.015,
      r,
      lifetime: 6000 + Math.random() * 6000,
      age: spreadY ? Math.random() * 6000 : 0,
    };
  }

  private _spawnInitialDots(): void {
    this._clearDots();
    for (let i = 0; i < MAX_DOTS; i++) {
      this._dots.push(this._makeDot(true));
    }
  }

  private _updateDots(dt: number): void {
    for (let i = 0; i < this._dots.length; i++) {
      const d = this._dots[i];
      if (!d) continue;
      d.age += dt;
      d.x += d.vx * dt;
      d.y += d.vy * dt;
      d.g.x = d.x;
      d.g.y = d.y;

      // Fade: in first 15%, stable, out last 15%.
      const t = d.age / d.lifetime;
      const alpha = t < 0.15
        ? t / 0.15
        : t > 0.85
          ? (1 - t) / 0.15
          : 1;
      d.g.alpha = alpha * 0.4;

      // Respawn when lifetime expires or dot drifts off-screen.
      if (d.age >= d.lifetime || d.y < -d.r) {
        this._particleLayer.removeChild(d.g);
        d.g.destroy();
        this._dots[i] = this._makeDot(false);
      }
    }
  }

  private _clearDots(): void {
    for (const d of this._dots) {
      this._particleLayer.removeChild(d.g);
      d.g.destroy();
    }
    this._dots = [];
  }
}
