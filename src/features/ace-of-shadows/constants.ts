/**
 * @file Ace of Shadows — feature-local constants.
 *
 * Kept separate from AppConfig because these are purely visual/layout values
 * that only the Ace of Shadows feature cares about.
 */

/** Card width in pixels. */
export const CARD_W = 80;

/** Card height in pixels. */
export const CARD_H = 112;

/** Border radius of each card's rounded rectangle, in pixels. */
export const CARD_RADIUS = 8;

/** Height of the color-band on each card face (identifies original stack). */
export const CARD_BAND_H = 20;

/** Number of columns in the stack grid. */
export const STACK_COLS = 3;

/** Number of rows in the stack grid. */
export const STACK_ROWS = 2;

/** Horizontal gap between stack columns, in pixels. */
export const STACK_GAP_X = 24;

/** Vertical gap between stack rows, in pixels. */
export const STACK_GAP_Y = 80;

/**
 * One colour per stack (0–5).
 * Cards carry the colour of their ORIGINAL stack for visual tracking.
 */
export const STACK_COLORS: readonly number[] = [
  0x2e7abb, // blue
  0xc0392b, // red
  0x27ae60, // green
  0x8e44ad, // purple
  0xd68910, // amber
  0x1a8a9b, // teal
] as const;
