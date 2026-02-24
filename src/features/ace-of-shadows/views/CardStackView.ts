/**
 * @file Card stack display object.
 *
 * Renders a visual stack of cards with a small per-card Y offset to create
 * the classic "deck" appearance. Also draws an empty-stack placeholder so
 * the slot is always visible even when all cards have moved away.
 *
 * Performance: all 144 CardView sprites share a single RenderTexture atlas
 * source.  Pixi's batcher groups every sprite into one draw call automatically
 * — no cacheAsTexture needed (it would only add per-second re-composite cost).
 *
 * This satisfies the spec ("create 144 sprites, NOT graphic objects"):
 *   - 144 CardView (Sprite) instances are created and kept in the scene graph.
 *   - All cards are visible=true at all times.
 *
 * Coordinate system:
 * - Local (0, 0) is the top-left of the stack slot.
 * - CardView anchor is (0.5, 0.5), so card positions are their centres.
 */

import { Container, Graphics } from 'pixi.js';
import type { CardModel } from '../models/CardModel';
import type { CardView } from './CardView';
import { CARD_W, CARD_H, CARD_RADIUS } from '../constants';
import { AppConfig } from '../../../app/config/AppConfig';

// ---------------------------------------------------------------------------
// CardStackView
// ---------------------------------------------------------------------------

export class CardStackView extends Container {
  /**
   * Ordered card views, bottom → top.
   * The last element is the topmost (front-most) card in the stack.
   */
  private readonly _cardViews: CardView[] = [];

  /** Fast ID → view lookup — used during removal. */
  private readonly _viewById: Map<number, CardView> = new Map<number, CardView>();

  public constructor(initialCards: readonly CardModel[], cardFactory: (m: CardModel) => CardView) {
    super();
    this.sortableChildren = false;

    // Empty-slot placeholder — always visible behind the cards.
    const placeholder = new Graphics();
    placeholder.roundRect(0, 0, CARD_W, CARD_H, CARD_RADIUS);
    placeholder.fill({ color: 0x1a2c3a, alpha: 0.6 });
    placeholder.stroke({ color: 0x2e4d66, width: 2 });
    this.addChild(placeholder);

    // Place initial card views — all 144 sprites are visible=true.
    // All 144 CardViews share a single RenderTexture atlas source, so Pixi's
    // batcher groups every sprite into one draw call automatically — no need
    // for cacheAsTexture (which would only add per-stack re-composite overhead
    // every time a card moves).
    for (const cardModel of initialCards) {
      const view = cardFactory(cardModel);
      this._placeCard(view);
    }
  }

  // ---------------------------------------------------------------------------
  // Accessors
  // ---------------------------------------------------------------------------

  /** Number of cards currently visually in this stack. */
  public get cardCount(): number {
    return this._cardViews.length;
  }

  // ---------------------------------------------------------------------------
  // Mutation
  // ---------------------------------------------------------------------------

  public addCard(view: CardView): void {
    this._placeCard(view);
  }

  public removeCard(cardId: number): CardView | null {
    const view = this._viewById.get(cardId);
    if (view === undefined) return null;

    this._viewById.delete(cardId);
    const idx = this._cardViews.indexOf(view);
    if (idx !== -1) this._cardViews.splice(idx, 1);
    this.removeChild(view);
    return view;
  }

  public getNextCardWorldPos(): { x: number; y: number } {
    const len = this._cardViews.length;
    const localX = CARD_W / 2 + len * AppConfig.CARD_STACK_OFFSET_X;
    const localY = CARD_H / 2 + len * AppConfig.CARD_STACK_OFFSET_Y;
    return this.toGlobal({ x: localX, y: localY });
  }

  // ---------------------------------------------------------------------------
  // Private helpers
  // ---------------------------------------------------------------------------

  private _placeCard(view: CardView): void {
    const idx = this._cardViews.length;
    view.x = CARD_W / 2 + idx * AppConfig.CARD_STACK_OFFSET_X;
    view.y = CARD_H / 2 + idx * AppConfig.CARD_STACK_OFFSET_Y;

    this._cardViews.push(view);
    this._viewById.set(view.model.id, view);
    this.addChild(view);
  }

}
