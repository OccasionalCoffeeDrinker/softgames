/**
 * @file Ace of Shadows — full feature scene.
 *
 * Rules (from the brief):
 * - 144 cards distributed evenly across 6 stacks (24 per stack at start).
 * - Every 1 second the topmost card of a random non-empty stack begins
 *   flying to another random (different) stack.
 * - The flight takes 2 seconds — so two cards can be in-flight simultaneously
 *   (natural parallelism: 1 s interval × 2 s duration).
 * - The `isMoving` flag on the model prevents the same card being picked twice.
 *
 * Architecture:
 *   CardStackModel[] — pure data, own the stack state.
 *   CardStackView[]  — display objects, mirror model state.
 *   flyingLayer      — Container above the stacks so in-flight cards render
 *                      on top of everything.
 *   TweenManager     — drives the 2 s lerp; killed on exit() for safety.
 */

import { Container, Graphics, Rectangle, RenderTexture, Text, TextStyle, Texture } from 'pixi.js';
import type { Scene } from '../../core/lifecycle/Scene';
import type { AppContext } from '../../types/index';
import { TweenManager, easeInOutQuad } from '../../core/lifecycle/TweenManager';
import { Button } from '../../ui/components/Button';
import { Typography } from '../../ui/theme/Theme';
import { AppConfig } from '../../app/config/AppConfig';
import { randomInt } from '../../core/utils/math';
import { createCard, CardModel } from './models/CardModel';
import { CardStackModel } from './models/CardStackModel';
import { CardView } from './views/CardView';

// ---------------------------------------------------------------------------
// Card face helpers (used when baking per-card RenderTextures)
// ---------------------------------------------------------------------------

const _SUITS  = ['\u2660', '\u2665', '\u2666', '\u2663'] as const;
const _SUIT_DARK = 0x1a1a1a;
const _SUIT_RED  = 0xcc2222;
const _VALUES = ['A','2','3','4','5','6','7','8','9','10','J','Q','K'] as const;

function _suitOf(id: number): { symbol: string; color: number } {
  const s = _SUITS[id % 4] ?? '\u2660';
  const color = (id % 4 === 0 || id % 4 === 3) ? _SUIT_DARK : _SUIT_RED;
  return { symbol: s, color };
}

function _valueOf(id: number): string {
  return _VALUES[id % 13] ?? 'A';
}

/**
 * Standard pip (x, y) positions for number cards 2–10 within an 80×112px card.
 * pip area: left col x=22, centre x=40, right col x=58; rows ya..yd.
 */
function _pipPositions(n: number): [number, number][] {
  const xl = 22, xc = 40, xr = 58;
  const ya = 40, yb = 54, ym = 64, yc = 74, yd = 88;
  switch (n) {
    case 2:  return [[xc,yb],[xc,yc]];
    case 3:  return [[xc,ya],[xc,ym],[xc,yd]];
    case 4:  return [[xl,yb],[xr,yb],[xl,yc],[xr,yc]];
    case 5:  return [[xl,yb],[xr,yb],[xc,ym],[xl,yc],[xr,yc]];
    case 6:  return [[xl,yb],[xr,yb],[xl,ym],[xr,ym],[xl,yc],[xr,yc]];
    case 7:  return [[xl,yb],[xr,yb],[xc,47],[xl,ym],[xr,ym],[xl,yc],[xr,yc]];
    case 8:  return [[xl,yb],[xr,yb],[xc,47],[xl,ym],[xr,ym],[xc,81],[xl,yc],[xr,yc]];
    case 9:  return [[xl,ya],[xr,ya],[xl,yb],[xr,yb],[xc,ym],[xl,yc],[xr,yc],[xl,yd],[xr,yd]];
    case 10: return [[xl,ya],[xr,ya],[xc,47],[xl,yb],[xr,yb],[xl,yc],[xr,yc],[xc,81],[xl,yd],[xr,yd]];
    default: return [[xc,ym]];
  }
}

/**
 * Build a realistic playing-card face Container for baking into the atlas.
 *
 * Layout:
 *  - Warm-white background + rounded border.
 *  - Thin coloured stripe on the left edge (stack identifier).
 *  - Top-left corner:  value (bold) + suit symbol below.
 *  - Bottom-right corner: same block rotated 180\u00b0 (reads upside-down, like a real card).
 *  - Centre:
 *      A      → one large pip.
 *      2–10   → pip grid matching standard card layout.
 *      J/Q/K  → tinted rect + big face letter + small suit.
 */
function _buildCardFace(
  bandColor: number,
  value: string,
  symbol: string,
  suitColor: number,
): Container {
  const face = new Container();

  // Background + border + stack-colour stripe on left edge
  const bg = new Graphics();
  bg.roundRect(0, 0, CARD_W, CARD_H, CARD_RADIUS);
  bg.fill({ color: 0xfaf8f2 });
  bg.stroke({ color: 0xbbbbbb, width: 1 });
  bg.roundRect(0, CARD_RADIUS, 5, CARD_H - CARD_RADIUS * 2, 2);
  bg.fill({ color: bandColor });
  face.addChild(bg);

  const valStyle  = new TextStyle({ fontFamily: 'serif', fontSize: 14, fontWeight: 'bold', fill: suitColor });
  const suitStyle = new TextStyle({ fontFamily: 'serif', fontSize: 11, fill: suitColor });

  // Top-left corner
  const tlVal  = new Text({ text: value,  style: valStyle  }); tlVal.x  = 7; tlVal.y  = 3;
  const tlSuit = new Text({ text: symbol, style: suitStyle }); tlSuit.x = 9; tlSuit.y = 18;
  face.addChild(tlVal);
  face.addChild(tlSuit);

  // Bottom-right corner — rotated 180\u00b0 so it reads upside-down like a real card
  const brCorner = new Container();
  const brVal  = new Text({ text: value,  style: valStyle  }); brVal.x  = 0; brVal.y  = 0;
  const brSuit = new Text({ text: symbol, style: suitStyle }); brSuit.x = 2; brSuit.y = 16;
  brCorner.addChild(brVal);
  brCorner.addChild(brSuit);
  brCorner.rotation = Math.PI;
  brCorner.x = CARD_W - 6;
  brCorner.y = CARD_H - 2;
  face.addChild(brCorner);

  // Centre content
  const isFace = value === 'J' || value === 'Q' || value === 'K';
  const isAce  = value === 'A';

  if (isFace) {
    // Tinted background rect + large letter + small suit
    const faceRect = new Graphics();
    faceRect.roundRect(8, 30, CARD_W - 16, CARD_H - 44, 4);
    faceRect.fill({ color: bandColor, alpha: 0.12 });
    face.addChild(faceRect);

    const bigLetterStyle = new TextStyle({ fontFamily: 'serif', fontSize: 34, fontWeight: 'bold', fill: suitColor });
    const bigLetter = new Text({ text: value, style: bigLetterStyle });
    bigLetter.anchor.set(0.5);
    bigLetter.x = CARD_W / 2;
    bigLetter.y = CARD_H / 2 + 4;
    face.addChild(bigLetter);

    const bigSuitStyle = new TextStyle({ fontFamily: 'serif', fontSize: 15, fill: suitColor });
    const bigSuit = new Text({ text: symbol, style: bigSuitStyle });
    bigSuit.anchor.set(0.5);
    bigSuit.x = CARD_W / 2;
    bigSuit.y = CARD_H / 2 + 26;
    face.addChild(bigSuit);
  } else if (isAce) {
    // Single large centre pip
    const aceStyle = new TextStyle({ fontFamily: 'serif', fontSize: 38, fill: suitColor });
    const acePip = new Text({ text: symbol, style: aceStyle });
    acePip.anchor.set(0.5);
    acePip.x = CARD_W / 2;
    acePip.y = CARD_H / 2 + 8;
    face.addChild(acePip);
  } else {
    // Number cards: standard pip grid
    const n = parseInt(value, 10);
    const pipStyle = new TextStyle({ fontFamily: 'serif', fontSize: 13, fill: suitColor });
    for (const [px, py] of _pipPositions(n)) {
      const pip = new Text({ text: symbol, style: pipStyle });
      pip.anchor.set(0.5);
      pip.x = px;
      pip.y = py;
      face.addChild(pip);
    }
  }

  return face;
}
import { CardStackView } from './views/CardStackView';
import {
  CARD_W,
  CARD_H,
  CARD_RADIUS,
  STACK_COLS,
  STACK_GAP_X,
  STACK_GAP_Y,
  STACK_COLORS,
} from './constants';

// ---------------------------------------------------------------------------
// Layout helpers
// ---------------------------------------------------------------------------

const GRID_W = STACK_COLS * CARD_W + (STACK_COLS - 1) * STACK_GAP_X;
const GRID_H = 2 * CARD_H + STACK_GAP_Y; // 2 rows

// ---------------------------------------------------------------------------
// AceOfShadowsScene
// ---------------------------------------------------------------------------

export class AceOfShadowsScene implements Scene {
  public readonly id = 'ace-of-shadows' as const;
  public readonly root: Container;
  public readonly tweens: TweenManager;

  private _ctx!: AppContext;

  // Display layers
  private _bg!: Graphics;
  private _stackLayer!: Container;
  private _flyingLayer!: Container;
  private _backBtn!: Button;
  private _counterLabel!: Text;
  private _stackCounters: Text[] = [];   // per-stack card count labels

  // Data / views
  private _models: CardStackModel[] = [];
  private _stackViews: CardStackView[] = [];
  private _cardTextures: Texture[] = [];
  // Single atlas RenderTexture shared by all 144 sub-textures.
  private _atlas: RenderTexture | null = null;
  // Atlas bake state — card face Containers are built on-demand in update()
  // to keep peak memory low (≤12 canvas objects at a time instead of 144).
  // _bakeData holds only plain numbers/strings (no Pixi objects).
  private _bakeCursor = 0;  // next card index to bake
  private _bakeData: { col: number; row: number; bandColor: number; value: string; symbol: string; color: number }[] = [];

  // Stored ATLAS_COLS so update() bake can compute face positions.
  private _atlasCols = 12;

  // Loading overlay shown while the atlas bakes over ~12 frames.
  // Card movement does not start until this is removed.
  private _loadingOverlay: Text | null = null;

  // Animation state
  private _intervalAcc = 0;
  private _moveCount = 0;
  private _width = 800;
  private _height = 600;

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

    // Display layers — stackLayer behind, flyingLayer on top.
    this._stackLayer = new Container();
    // Natural addChild order gives correct z — no per-frame sort needed.
    this._stackLayer.sortableChildren = false;
    this.root.addChild(this._stackLayer);

    this._flyingLayer = new Container();
    // sortableChildren not needed — addChild already brings-to-front.
    this._flyingLayer.sortableChildren = false;
    this.root.addChild(this._flyingLayer);

    // ---------------------------------------------------------------------------
    // Atlas: compute bake metadata for all 144 cards.
    // Card face Containers are built ON DEMAND in update() (12 per frame) so
    // peak canvas/memory is ≤12 objects at a time instead of 144.
    // A single renderer.render() per frame (1 GPU call, not 12) writes the batch
    // into the correct atlas slots via face.x/y offsets.
    // ---------------------------------------------------------------------------
    const perStack = AppConfig.CARD_COUNT / AppConfig.STACK_COUNT; // 24
    const ATLAS_COLS = 12;

    const atlasW = ATLAS_COLS * CARD_W;
    const atlasH = Math.ceil(AppConfig.CARD_COUNT / ATLAS_COLS) * CARD_H;
    const rt = RenderTexture.create({ width: atlasW, height: atlasH });
    this._atlas = rt;

    // Pre-compute only plain data — zero Pixi object allocations here.
    for (let cardId = 0; cardId < AppConfig.CARD_COUNT; cardId++) {
      const col      = cardId % ATLAS_COLS;
      const row      = Math.floor(cardId / ATLAS_COLS);
      const stackIdx = Math.floor(cardId / perStack);
      const bandColor = STACK_COLORS[stackIdx] ?? 0x2e7abb;
      const value     = _valueOf(cardId);
      const { symbol, color } = _suitOf(cardId);
      this._bakeData.push({ col, row, bandColor, value, symbol, color });
    }

    // Slice sub-textures immediately — RT source exists before the bake so
    // sprites are created now (show transparent until their tile is painted).
    this._cardTextures = Array.from({ length: AppConfig.CARD_COUNT }, (_, id) => {
      const col = id % ATLAS_COLS;
      const row = Math.floor(id / ATLAS_COLS);
      return new Texture({
        source: rt.source,
        frame:  new Rectangle(col * CARD_W, row * CARD_H, CARD_W, CARD_H),
      });
    });

    // Close over ATLAS_COLS so the update() bake loop can use it.
    this._atlasCols = ATLAS_COLS;

    const cardFactory = (m: CardModel): CardView =>
      new CardView(m, this._cardTextures[m.id] ?? Texture.EMPTY);
    for (let s = 0; s < AppConfig.STACK_COUNT; s++) {
      const cards = [];
      for (let i = 0; i < perStack; i++) {
        cards.push(createCard(s * perStack + i));
      }
      this._models.push(new CardStackModel(s, cards));
    }

    // Build one CardStackView per model.
    for (const model of this._models) {
      const view = new CardStackView(model.cards, cardFactory);
      this._stackLayer.addChild(view);
      this._stackViews.push(view);
    }

    // Counter label — shows total completed moves.
    this._counterLabel = new Text({
      text: 'Moves: 0',
      style: new TextStyle({
        fontFamily: Typography.FONT_FAMILY_MONO,
        fontSize: 18,
        fill: 0xffffff,
        fontWeight: 'bold',
        dropShadow: { alpha: 0.5, distance: 2, blur: 2, color: 0x000000, angle: Math.PI / 4 },
      }),
    });
    this._counterLabel.anchor.set(0.5, 0);
    this.root.addChild(this._counterLabel);

    // Per-stack card count labels.
    const cntStyle = new TextStyle({
      fontFamily: Typography.FONT_FAMILY_MONO,
      fontSize: 13,
      fontWeight: 'bold',
      fill: 0xffffff,
      dropShadow: { alpha: 0.45, distance: 2, blur: 2, color: 0x000000, angle: Math.PI / 4 },
    });
    for (let s = 0; s < AppConfig.STACK_COUNT; s++) {
      const lbl = new Text({
        text: `${AppConfig.CARD_COUNT / AppConfig.STACK_COUNT}`,
        style: cntStyle,
      });
      lbl.anchor.set(0.5, 0);
      this._stackCounters.push(lbl);
      this.root.addChild(lbl);
    }

    // Back button
    this._backBtn = new Button({
      label: '← Back to Menu',
      onClick: () => {
        void import('../../scenes/MenuScene').then(({ MenuScene }) => {
          this._ctx.sceneManager.go(new MenuScene());
        });
      },
    });
    this.root.addChild(this._backBtn.view);

    // Loading overlay — sits on top of everything while the atlas bakes.
    // Removed automatically in update() when the bake queue drains.
    this._loadingOverlay = new Text({
      text: 'Preparing cards…',
      style: new TextStyle({
        fontFamily: Typography.FONT_FAMILY_MONO,
        fontSize: 16,
        fill: 0x888888,
      }),
    });
    this._loadingOverlay.anchor.set(0.5);
    this.root.addChild(this._loadingOverlay);
  }

  public enter(): void {
    this._intervalAcc = 0;
  }

  public update(dt: number): void {
    // Incremental atlas bake: build, render and immediately destroy a small
    // batch of card face Containers each frame.
    // Benefits vs pre-building all 144 upfront:
    //   • Peak memory: ≤12 canvas objects alive at once (vs 144 before).
    //   • 1 GPU renderer.render() call per frame (vs 12 per frame before).
    //   • GC pressure is minimal and evenly spread instead of bursty.
    if (this._bakeCursor < AppConfig.CARD_COUNT) {
      const atlas = this._atlas;
      if (atlas !== null) {
        const BAKE_PER_FRAME = 12;
        const end = Math.min(this._bakeCursor + BAKE_PER_FRAME, AppConfig.CARD_COUNT);
        const batchStage = new Container();
        for (let i = this._bakeCursor; i < end; i++) {
          const d = this._bakeData[i];
          if (d === undefined) break;
          const face = _buildCardFace(d.bandColor, d.value, d.symbol, d.color);
          face.x = d.col * CARD_W;
          face.y = d.row * CARD_H;
          batchStage.addChild(face);
        }
        this._ctx.app.renderer.render({ container: batchStage, target: atlas, clear: false });
        batchStage.destroy({ children: true });
        this._bakeCursor = end;

        if (this._bakeCursor >= AppConfig.CARD_COUNT) {
          this._bakeData = [];   // free plain data, no longer needed
          if (this._loadingOverlay !== null) {
            this.root.removeChild(this._loadingOverlay);
            this._loadingOverlay.destroy();
            this._loadingOverlay = null;
          }
        }
      }
    }

    this.tweens.update(dt);

    // Card movement only starts once the atlas is fully baked.
    if (this._loadingOverlay === null) {
      this._intervalAcc += dt;
      if (this._intervalAcc >= AppConfig.CARD_MOVE_INTERVAL_MS) {
        this._intervalAcc -= AppConfig.CARD_MOVE_INTERVAL_MS;
        this._triggerMove();
      }
    }
  }

  public resize(width: number, height: number): void {
    this._width = width;
    this._height = height;
    this._layout();
  }

  public exit(): void {
    this._intervalAcc = 0;
    this.tweens.killAll();
    // Safety: remove any cards still in-flight so they don't persist on re-entry.
    this._flyingLayer.removeChildren();
    for (const model of this._models) {
      model.resetMovingFlags();
    }
  }

  public destroy(): void {
    this._backBtn.destroy();
    this._models = [];
    this._stackViews = [];
    this._bakeData = [];
    // Sub-textures share the atlas source — destroy the atlas to free GPU memory.
    this._atlas?.destroy(true);
    this._atlas = null;
    this._cardTextures = [];
    this.root.destroy({ children: true });
  }

  // ---------------------------------------------------------------------------
  // Move logic
  // ---------------------------------------------------------------------------

  private _triggerMove(): void {
    // Eligible sources: non-empty stack whose top card is not already moving.
    const eligible = this._models.filter(
      (m) => m.topCard !== null && !m.topCard.isMoving,
    );
    if (eligible.length < 1) return;

    const sourceModel = eligible[randomInt(0, eligible.length - 1)];
    if (!sourceModel) return;

    const others = this._models.filter((m) => m.id !== sourceModel.id);
    const destModel = others[randomInt(0, others.length - 1)];
    if (!destModel) return;

    const card = sourceModel.pop();
    if (!card) return;

    const srcView = this._stackViews[sourceModel.id];
    const dstView = this._stackViews[destModel.id];
    if (!srcView || !dstView) return;

    const cardView = srcView.removeCard(card.id);
    if (!cardView) return;

    // Convert start position (world) → flying layer local.
    const worldStart = srcView.toGlobal({ x: cardView.x, y: cardView.y });
    const localStart = this._flyingLayer.toLocal(worldStart);

    // Destination: where the arriving card will sit on the dest stack.
    const worldDest = dstView.getNextCardWorldPos();
    const localDest = this._flyingLayer.toLocal(worldDest);

    // Reparent to flying layer — always on top (addChild brings to front naturally).
    cardView.x = localStart.x;
    cardView.y = localStart.y;
    this._flyingLayer.addChild(cardView);

    const sx = cardView.x;
    const sy = cardView.y;
    const dx = localDest.x;
    const dy = localDest.y;

    // Quadratic Bezier — control point at 50% toward dest and high up,
    // giving a forward-biased "throw" arc rather than a symmetric parabola.
    const cx = sx + (dx - sx) * 0.5;
    const cy = Math.min(sy, dy) - 110;

    this.tweens.add({
      duration: AppConfig.CARD_MOVE_DURATION_MS,
      easing: easeInOutQuad,
      onUpdate: (p) => {
        const q = 1 - p;
        cardView.x = q * q * sx + 2 * q * p * cx + p * p * dx;
        cardView.y = q * q * sy + 2 * q * p * cy + p * p * dy;
        // Tilt: leans forward on the way up, backward on the way down
        cardView.rotation = (p - 0.5) * 0.22;
        // Scale breathes up at peak for a sense of depth
        cardView.scale.set(1 + 0.05 * Math.sin(p * Math.PI));
      },
      onComplete: () => {
        this._flyingLayer.removeChild(cardView);
        cardView.rotation = 0;
        cardView.scale.set(1);
        dstView.addCard(cardView);
        destModel.push(card);
        this._moveCount++;
        this._counterLabel.text = `Moves: ${this._moveCount}`;
        // Update per-stack card counts.
        const srcCnt = this._stackCounters[sourceModel.id];
        const dstCnt = this._stackCounters[destModel.id];
        const srcView2 = this._stackViews[sourceModel.id];
        const dstView2 = this._stackViews[destModel.id];
        if (srcCnt && srcView2) srcCnt.text = String(srcView2.cardCount);
        if (dstCnt && dstView2) dstCnt.text = String(dstView2.cardCount);
        // Settle bounce: asymmetric squash (X widens, Y compresses) + micro Y drop
        // Separate X/Y scale gives a physical "card hits table" feel.
        const landY = cardView.y;
        this.tweens.add({
          duration: 130,
          easing: easeInOutQuad,
          onUpdate: (q) => {
            const lift = Math.sin(q * Math.PI);
            cardView.y = landY + 6 * lift;
            cardView.scale.x = 1 + 0.04 * lift;  // widens on impact
            cardView.scale.y = 1 - 0.06 * lift;  // compresses on impact
          },
          onComplete: () => { cardView.scale.set(1); cardView.y = landY; },
        });
      },
    });
  }

  // ---------------------------------------------------------------------------
  // Layout
  // ---------------------------------------------------------------------------

  private _layout(): void {
    this._bg.clear();
    this._bg.rect(0, 0, this._width, this._height);
    this._bg.fill({ color: 0x1a4a2a });  // green felt board

    // Centre the 3×2 stack grid vertically between the top label and button.
    const topPad = 52;
    const bottomPad = 80;
    const available = this._height - topPad - bottomPad;
    const gridTop = topPad + (available - GRID_H) / 2;
    const gridLeft = (this._width - GRID_W) / 2;

    for (let s = 0; s < AppConfig.STACK_COUNT; s++) {
      const view = this._stackViews[s];
      if (!view) continue;
      const col = s % STACK_COLS;
      const row = Math.floor(s / STACK_COLS);
      const rowShift = row === 0 ? -50 : 0;
      view.x = gridLeft + col * (CARD_W + STACK_GAP_X);
      view.y = gridTop + row * (CARD_H + STACK_GAP_Y) + rowShift;

      // Position counter label above the stack slot as a HUD label.
      const counter = this._stackCounters[s];
      if (counter) {
        counter.x = view.x + CARD_W / 2;
        counter.y = view.y - 20;
      }
    }

    this._counterLabel.x = this._width / 2;
    this._counterLabel.y = 14;

    if (this._loadingOverlay !== null) {
      this._loadingOverlay.x = this._width / 2;
      this._loadingOverlay.y = this._height / 2;
    }

    this._backBtn.x = this._width / 2 - 140;
    this._backBtn.y = this._height - 72;
  }
}
