/**
 * @file Tests for core math utilities.
 */

import { describe, it, expect } from 'vitest';
import {
  lerp,
  clamp,
  mapRange,
  randomRange,
  randomInt,
  randomPick,
  buildLookupTable,
  sampleLookup,
  degToRad,
  radToDeg,
} from './math';

describe('lerp', () => {
  it('returns start at t=0', () => expect(lerp(0, 10, 0)).toBe(0));
  it('returns end at t=1', () => expect(lerp(0, 10, 1)).toBe(10));
  it('returns midpoint at t=0.5', () => expect(lerp(0, 10, 0.5)).toBe(5));
  it('supports negative range', () => expect(lerp(-10, 10, 0.5)).toBe(0));
});

describe('clamp', () => {
  it('clamps below min', () => expect(clamp(-5, 0, 1)).toBe(0));
  it('clamps above max', () => expect(clamp(5, 0, 1)).toBe(1));
  it('passes through mid value', () => expect(clamp(0.5, 0, 1)).toBe(0.5));
  it('passes through exact min', () => expect(clamp(0, 0, 1)).toBe(0));
  it('passes through exact max', () => expect(clamp(1, 0, 1)).toBe(1));
});

describe('mapRange', () => {
  it('maps midpoint correctly', () => {
    expect(mapRange(5, 0, 10, 0, 100)).toBe(50);
  });
  it('maps start of input range to start of output range', () => {
    expect(mapRange(0, 0, 10, 0, 100)).toBe(0);
  });
  it('maps end of input range to end of output range', () => {
    expect(mapRange(10, 0, 10, 0, 100)).toBe(100);
  });
});

describe('randomRange', () => {
  it('returns values within the specified range', () => {
    for (let i = 0; i < 100; i++) {
      const v = randomRange(2, 5);
      expect(v).toBeGreaterThanOrEqual(2);
      expect(v).toBeLessThanOrEqual(5);
    }
  });
});

describe('randomInt', () => {
  it('returns integers within [min, max]', () => {
    const seen = new Set<number>();
    for (let i = 0; i < 1000; i++) seen.add(randomInt(0, 3));
    expect([...seen].sort()).toEqual([0, 1, 2, 3]);
  });
  it('returns min when min === max', () => {
    expect(randomInt(7, 7)).toBe(7);
  });
});

describe('randomPick', () => {
  it('always returns an element from the array', () => {
    const arr = [10, 20, 30];
    for (let i = 0; i < 50; i++) {
      expect(arr).toContain(randomPick(arr));
    }
  });
});

describe('buildLookupTable + sampleLookup', () => {
  it('linear table samples correctly at 0, 0.5, 1', () => {
    const table = buildLookupTable(100, (t) => t);
    expect(sampleLookup(table, 0)).toBeCloseTo(0, 2);
    expect(sampleLookup(table, 0.5)).toBeCloseTo(0.5, 2);
    expect(sampleLookup(table, 1)).toBeCloseTo(1, 2);
  });

  it('constant table returns the same value everywhere', () => {
    const table = buildLookupTable(10, () => 0.42);
    expect(sampleLookup(table, 0)).toBeCloseTo(0.42);
    expect(sampleLookup(table, 0.99)).toBeCloseTo(0.42);
  });
});

describe('degToRad / radToDeg', () => {
  it('180 deg === PI rad', () => expect(degToRad(180)).toBeCloseTo(Math.PI));
  it('PI rad === 180 deg', () => expect(radToDeg(Math.PI)).toBeCloseTo(180));
  it('round-trips correctly', () => {
    const deg = 137.5;
    expect(radToDeg(degToRad(deg))).toBeCloseTo(deg);
  });
});
