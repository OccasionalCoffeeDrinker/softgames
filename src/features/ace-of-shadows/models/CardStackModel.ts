/**
 * @file Card stack data model.
 *
 * Manages an ordered array of cards (bottom → top).
 * The "top" of the stack is the last element of the internal array.
 *
 * No PixiJS dependencies — pure data logic, fully unit-testable.
 */

import type { CardModel } from './CardModel';

export class CardStackModel {
  /** Stack identifier — matches its index in the scene's model array. */
  public readonly id: number;

  /** Cards stored bottom → top. The last element is the topmost card. */
  private readonly _cards: CardModel[];

  public constructor(id: number, initialCards: CardModel[]) {
    this.id = id;
    this._cards = [...initialCards];
  }

  // ---------------------------------------------------------------------------
  // Accessors
  // ---------------------------------------------------------------------------

  /** The topmost card, or `null` if the stack is empty. */
  public get topCard(): CardModel | null {
    return this._cards[this._cards.length - 1] ?? null;
  }

  /** Number of cards currently in the stack. */
  public get count(): number {
    return this._cards.length;
  }

  /** Read-only view of the ordered card array (bottom → top). */
  public get cards(): readonly CardModel[] {
    return this._cards;
  }

  // ---------------------------------------------------------------------------
  // Mutation
  // ---------------------------------------------------------------------------

  /**
   * Remove and return the top card, marking it as `isMoving = true`.
   *
   * Returns `null` if:
   * - The stack is empty.
   * - The top card is already moving (guard against double-pick).
   */
  public pop(): CardModel | null {
    const top = this.topCard;
    if (top === null || top.isMoving) return null;

    top.isMoving = true;
    this._cards.pop();
    return top;
  }

  /**
   * Place a card on top of the stack, clearing its `isMoving` flag.
   *
   * @param card - The card arriving from another stack.
   */
  public push(card: CardModel): void {
    card.isMoving = false;
    this._cards.push(card);
  }

  /**
   * Reset all `isMoving` flags — called on scene exit to leave models clean.
   */
  public resetMovingFlags(): void {
    for (const card of this._cards) {
      card.isMoving = false;
    }
  }
}
