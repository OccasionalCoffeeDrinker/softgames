/**
 * @file Card data model.
 *
 * A plain value object — no PixiJS dependencies.
 * `isMoving` is mutable so the scene can toggle it during animation.
 */

export interface CardModel {
  /** Unique card identifier in the range [0, CARD_COUNT). */
  readonly id: number;

  /**
   * True while the card is being animated between stacks.
   * Prevents the same card from being picked for a second move mid-flight.
   */
  isMoving: boolean;
}

/**
 * Factory — creates a card in its default (not-moving) state.
 */
export function createCard(id: number): CardModel {
  return { id, isMoving: false };
}
