/**
 * @file Tests for CardStackModel.
 */

import { describe, it, expect } from 'vitest';
import { createCard } from './CardModel';
import { CardStackModel } from './CardStackModel';

function makeStack(id: number, count: number): CardStackModel {
  const cards = Array.from({ length: count }, (_, i) => createCard(i));
  return new CardStackModel(id, cards);
}

describe('CardStackModel', () => {
  it('reports correct initial count', () => {
    const stack = makeStack(0, 5);
    expect(stack.count).toBe(5);
  });

  it('reports null topCard on an empty stack', () => {
    const stack = makeStack(0, 0);
    expect(stack.topCard).toBeNull();
  });

  it('topCard is the last card added', () => {
    const stack = makeStack(0, 3);
    expect(stack.topCard?.id).toBe(2);
  });

  describe('pop()', () => {
    it('returns the top card and decrements count', () => {
      const stack = makeStack(0, 3);
      const card = stack.pop();
      expect(card?.id).toBe(2);
      expect(stack.count).toBe(2);
    });

    it('marks the returned card as isMoving', () => {
      const stack = makeStack(0, 1);
      const card = stack.pop();
      expect(card?.isMoving).toBe(true);
    });

    it('returns null from an empty stack', () => {
      const stack = makeStack(0, 0);
      expect(stack.pop()).toBeNull();
    });

    it('returns null if the top card is already moving', () => {
      const stack = makeStack(0, 1);
      const top = stack.topCard;
      if (!top) throw new Error('Expected a top card');
      top.isMoving = true;
      expect(stack.pop()).toBeNull();
    });
  });

  describe('push()', () => {
    it('adds a card to the top and increments count', () => {
      const stack = makeStack(0, 2);
      const card = createCard(99);
      stack.push(card);
      expect(stack.count).toBe(3);
      expect(stack.topCard?.id).toBe(99);
    });

    it('clears the isMoving flag on the pushed card', () => {
      const stack = makeStack(0, 0);
      const card = createCard(0);
      card.isMoving = true;
      stack.push(card);
      expect(card.isMoving).toBe(false);
    });
  });

  describe('resetMovingFlags()', () => {
    it('clears isMoving on all remaining cards', () => {
      const stack = makeStack(0, 3);
      for (const c of stack.cards) c.isMoving = true;
      stack.resetMovingFlags();
      expect(stack.cards.every((c) => !c.isMoving)).toBe(true);
    });
  });

  it('full round-trip: pop then push restores count', () => {
    const stackA = makeStack(0, 3);
    const stackB = makeStack(1, 0);
    const card = stackA.pop();
    if (!card) throw new Error('Expected a card from pop()');
    stackB.push(card);
    expect(stackA.count).toBe(2);
    expect(stackB.count).toBe(1);
    expect(stackB.topCard?.id).toBe(card.id);
  });
});
