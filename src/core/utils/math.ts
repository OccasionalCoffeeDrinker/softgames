/**
 * @file Pure math utility functions.
 *
 * All functions are pure, stateless, and trivially testable.
 * No Pixi or DOM dependencies allowed in this file.
 */

// ---------------------------------------------------------------------------
// Interpolation
// ---------------------------------------------------------------------------

/**
 * Linear interpolation between two values.
 *
 * @param a - Start value.
 * @param b - End value.
 * @param t - Normalised time in [0, 1].
 * @returns The interpolated value.
 */
export function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

/**
 * 2D vector linear interpolation.
 *
 * @param ax - Start x.
 * @param ay - Start y.
 * @param bx - End x.
 * @param by - End y.
 * @param t  - Normalised time in [0, 1].
 */
export function lerp2d(
  ax: number,
  ay: number,
  bx: number,
  by: number,
  t: number,
): { x: number; y: number } {
  return { x: lerp(ax, bx, t), y: lerp(ay, by, t) };
}

// ---------------------------------------------------------------------------
// Range / clamping
// ---------------------------------------------------------------------------

/**
 * Clamp a value within an inclusive range.
 *
 * @param value - The input value.
 * @param min   - Minimum bound.
 * @param max   - Maximum bound.
 */
export function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

/**
 * Map a value from one range to another.
 *
 * @param value  - Input value within [inMin, inMax].
 * @param inMin  - Input range minimum.
 * @param inMax  - Input range maximum.
 * @param outMin - Output range minimum.
 * @param outMax - Output range maximum.
 */
export function mapRange(
  value: number,
  inMin: number,
  inMax: number,
  outMin: number,
  outMax: number,
): number {
  return outMin + ((value - inMin) / (inMax - inMin)) * (outMax - outMin);
}

// ---------------------------------------------------------------------------
// Random
// ---------------------------------------------------------------------------

/**
 * Random float in [min, max).
 */
export function randomRange(min: number, max: number): number {
  return min + Math.random() * (max - min);
}

/**
 * Random integer in [min, max] (inclusive).
 */
export function randomInt(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

/**
 * Pick a random element from an array.
 * Returns `undefined` if the array is empty.
 */
export function randomPick<T>(arr: readonly T[]): T | undefined {
  if (arr.length === 0) return undefined;
  return arr[Math.floor(Math.random() * arr.length)];
}

// ---------------------------------------------------------------------------
// Lookup table helpers
// ---------------------------------------------------------------------------

/**
 * Build a precomputed lookup table of `steps + 1` values using a generator function.
 *
 * Used for particle curves (alpha, scale, tint) to eliminate per-frame math.
 *
 * @param steps     - Number of intervals (table has `steps + 1` entries).
 * @param generator - Function receiving normalised t ∈ [0, 1].
 *
 * @example
 * const alphaTable = buildLookupTable(10, (t) => 1 - t); // linear fade
 */
export function buildLookupTable(steps: number, generator: (t: number) => number): Float32Array {
  const table = new Float32Array(steps + 1);

  for (let i = 0; i <= steps; i++) {
    table[i] = generator(i / steps);
  }

  return table;
}

/**
 * Sample a lookup table using normalised time `t ∈ [0, 1]`.
 * Uses floor-based indexing — fast and branch-free.
 *
 * @param table - Lookup table produced by `buildLookupTable`.
 * @param t     - Normalised time in [0, 1].
 */
export function sampleLookup(table: Float32Array, t: number): number {
  const index = Math.floor(clamp(t, 0, 1) * (table.length - 1));
  return table[index] ?? 0;
}

// ---------------------------------------------------------------------------
// Angles
// ---------------------------------------------------------------------------

/** Convert degrees to radians. */
export function degToRad(degrees: number): number {
  return (degrees * Math.PI) / 180;
}

/** Convert radians to degrees. */
export function radToDeg(radians: number): number {
  return (radians * 180) / Math.PI;
}
