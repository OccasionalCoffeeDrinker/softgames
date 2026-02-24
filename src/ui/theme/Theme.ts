/**
 * @file Visual design tokens — single source of truth for colours, typography and spacing.
 *
 * All UI components pull values from here.
 * Changing a colour or font size in this file updates the entire UI automatically.
 */

// ---------------------------------------------------------------------------
// Colour palette
// ---------------------------------------------------------------------------

export const Colors = {
  /** Page / canvas background. */
  BACKGROUND: 0x0a0a0f,

  /** Primary accent — used for highlights, FPS meter, active elements. */
  ACCENT: 0x00ff88,

  /** Secondary accent — used for hover states and secondary buttons. */
  ACCENT_SECONDARY: 0xff6b35,

  // --- Text ---
  TEXT_PRIMARY: 0xffffff,
  TEXT_SECONDARY: 0xaaaaaa,
  TEXT_MUTED: 0x666666,

  // --- Buttons ---
  BUTTON_BG: 0x1a1a2e,
  BUTTON_BG_HOVER: 0x16213e,
  BUTTON_BORDER: 0x00ff88,
  BUTTON_BORDER_HOVER: 0xff6b35,
  BUTTON_TEXT: 0xffffff,

  // --- Chat bubbles (Magic Words) ---
  BUBBLE_LEFT_BG: 0x1e3a5f,
  BUBBLE_RIGHT_BG: 0x1a2e1a,
  BUBBLE_BORDER: 0x2a5a8f,

  // --- Menu background gradient stop ---
  MENU_BG_TOP: 0x0a0a0f,
  MENU_BG_BOTTOM: 0x0d1b2a,
} as const;

// ---------------------------------------------------------------------------
// Typography
// ---------------------------------------------------------------------------

export const Typography = {
  FONT_FAMILY_PRIMARY: 'system-ui, -apple-system, sans-serif',
  FONT_FAMILY_MONO: 'ui-monospace, monospace',

  // --- Font sizes ---
  SIZE_XS: 11,
  SIZE_SM: 13,
  SIZE_MD: 16,
  SIZE_LG: 20,
  SIZE_XL: 28,
  SIZE_TITLE: 38,

  // --- Line heights ---
  LINE_HEIGHT_TIGHT: 16,
  LINE_HEIGHT_NORMAL: 20,
  LINE_HEIGHT_LOOSE: 26,
} as const;

// ---------------------------------------------------------------------------
// Spacing
// ---------------------------------------------------------------------------

export const Spacing = {
  XS: 4,
  SM: 8,
  MD: 16,
  LG: 24,
  XL: 40,
  XXL: 64,
} as const;

// ---------------------------------------------------------------------------
// Z-index layers
// ---------------------------------------------------------------------------

/**
 * Explicit z-index layers — prevents ad-hoc z-fighting.
 */
export const ZIndex = {
  /** Scene content — stacks, particles, chat bubbles. */
  SCENE: 0,
  /** UI floating above the scene (back button, etc.). */
  UI: 100,
  /** FPS meter — always on top of everything. */
  FPS_METER: 9999,
  /** Debug overlay — above even the FPS meter. */
  DEBUG_OVERLAY: 10000,
} as const;
