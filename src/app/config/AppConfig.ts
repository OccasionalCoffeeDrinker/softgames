/**
 * @file Central application constants.
 *
 * All magic numbers and tunable parameters live here — never inline.
 * Modify this file to adjust behaviour without hunting through feature code.
 */

// ---------------------------------------------------------------------------
// Renderer
// ---------------------------------------------------------------------------

export const AppConfig = {
  // ---------------------------------------------------------------------------
  // Renderer
  // ---------------------------------------------------------------------------

  /** Background colour of the PixiJS canvas. */
  BACKGROUND_COLOR: 0x0a0a0f,

  /** Target frames per second — used for Ticker normalisation. */
  TARGET_FPS: 60,

  /** Minimum FPS before a soft warning is logged. */
  FPS_WARNING_THRESHOLD: 30,

  // ---------------------------------------------------------------------------
  // FPS meter
  // ---------------------------------------------------------------------------

  /** How often to refresh the FPS display, in milliseconds. */
  FPS_UPDATE_INTERVAL_MS: 250,

  // ---------------------------------------------------------------------------
  // Ace of Shadows
  // ---------------------------------------------------------------------------

  /** Total number of card sprites created on scene enter. */
  CARD_COUNT: 144,

  /** Number of stacks to distribute cards across. */
  STACK_COUNT: 6,

  /** How often a new card move is triggered, in milliseconds. */
  CARD_MOVE_INTERVAL_MS: 1000,

  /** Duration of a single card move animation, in milliseconds. */
  CARD_MOVE_DURATION_MS: 2000,

  /** Vertical offset between stacked cards, in pixels (creates the "deck" look). */
  CARD_STACK_OFFSET_Y: 4,

  /** Horizontal offset between stacked cards, in pixels. */
  CARD_STACK_OFFSET_X: 0.5,

  // ---------------------------------------------------------------------------
  // Magic Words
  // ---------------------------------------------------------------------------

  /** Endpoint URL for the Magic Words dialogue data. */
  MAGIC_WORDS_API_URL:
    'https://private-624120-softgamesassignment.apiary-mock.com/v2/magicwords',

  /** Network request timeout, in milliseconds. */
  API_TIMEOUT_MS: 8000,

  /** Fixed width used for emoji "atoms" in the inline layout, in pixels. */
  EMOJI_INLINE_SIZE: 26,

  /** Horizontal margin around each inline emoji, in pixels. */
  EMOJI_INLINE_MARGIN: 3,

  /** Duration of the chat message appear animation, in milliseconds. */
  MESSAGE_APPEAR_DURATION_MS: 150,

  // ---------------------------------------------------------------------------
  // Phoenix Flame
  // ---------------------------------------------------------------------------

  /** Hard cap on simultaneously active particle sprites. Enforced in ParticlePool. */
  PARTICLE_CAP: 10,

  /** Interval between particle spawns, in milliseconds. */
  PARTICLE_SPAWN_INTERVAL_MS: 80,

  /** Minimum particle lifetime, in milliseconds. */
  PARTICLE_LIFETIME_MIN_MS: 600,

  /** Maximum particle lifetime, in milliseconds. */
  PARTICLE_LIFETIME_MAX_MS: 1200,

  /** Number of steps in precomputed particle curve lookup tables. */
  PARTICLE_LOOKUP_STEPS: 10,

  // ---------------------------------------------------------------------------
  // Debug
  // ---------------------------------------------------------------------------

  /** URL query parameter that enables the debug overlay. */
  DEBUG_FLAG: 'debug',
} as const;

/** Convenience type — the full config object shape. */
export type AppConfigType = typeof AppConfig;
