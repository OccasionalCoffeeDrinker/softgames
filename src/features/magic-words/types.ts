/**
 * @file Magic Words — API payload types.
 *
 * These types mirror the Softgames mock API response exactly.
 *
 * NOTE: The field `emojies` is intentionally misspelled to match the API.
 *       See docs/DECISIONS.md ADR-003.
 */

// ---------------------------------------------------------------------------
// API response shape
// ---------------------------------------------------------------------------

export interface EmojiDefinition {
  /** Emoji token name used in message text, e.g. "happy". */
  name: string;
  /** URL to the emoji image asset. */
  url: string;
}

export interface AvatarDefinition {
  /** Character name this avatar belongs to. */
  name: string;
  /** URL to the avatar image asset. */
  url: string;
  /** Which side of the chat this character appears on. Defaults to 'left' if absent. */
  position?: 'left' | 'right';
}

export interface DialogueLine {
  /** Character name — must match an entry in `avatars` for the image to load. */
  name: string;
  /** Raw message text — may contain `{emojiName}` tokens. */
  text: string;
}

/** Root response from GET /v2/magicwords */
export interface MagicWordsResponse {
  /** Intentionally misspelled — matches API field name exactly. */
  emojies: EmojiDefinition[];
  avatars: AvatarDefinition[];
  dialogue: DialogueLine[];
}

// ---------------------------------------------------------------------------
// Type guard
// ---------------------------------------------------------------------------

/**
 * Runtime check that an unknown value is a valid {@link MagicWordsResponse}.
 * Used to validate the API response before trusting its shape.
 */
export function isMagicWordsResponse(value: unknown): value is MagicWordsResponse {
  if (typeof value !== 'object' || value === null) return false;
  const v = value as Record<string, unknown>;
  return (
    Array.isArray(v.emojies) &&
    Array.isArray(v.avatars) &&
    Array.isArray(v.dialogue)
  );
}
