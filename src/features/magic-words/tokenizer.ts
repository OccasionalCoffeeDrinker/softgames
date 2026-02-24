/**
 * @file Inline content tokenizer.
 *
 * Parses a raw message string like:
 *   "Hello {happy} world {win}!"
 *
 * Into an ordered array of typed tokens:
 *   [
 *     { kind: 'text',  value: 'Hello '   },
 *     { kind: 'emoji', name:  'happy'    },
 *     { kind: 'text',  value: ' world '  },
 *     { kind: 'emoji', name:  'win'      },
 *     { kind: 'text',  value: '!'        },
 *   ]
 *
 * The renderer then lays out each token left-to-right, substituting emoji
 * sprites for known names and falling back to a styled "[name]" Text node
 * for unknown emoji tokens.
 */

// ---------------------------------------------------------------------------
// Token types
// ---------------------------------------------------------------------------

export interface TextToken {
  kind: 'text';
  value: string;
}

export interface EmojiToken {
  kind: 'emoji';
  /** The name inside `{…}`, e.g. "happy". */
  name: string;
}

/** Union of all possible inline content tokens. */
export type InlineToken = TextToken | EmojiToken;

// ---------------------------------------------------------------------------
// Tokenizer
// ---------------------------------------------------------------------------

const EMOJI_PATTERN = /\{([^}]+)\}/g;

/**
 * Split a raw dialogue string into an ordered array of inline tokens.
 *
 * Rules:
 * - `{name}` → EmojiToken with that name.
 * - Everything else → TextToken.
 * - Consecutive text runs are NOT merged (regex guarantees non-overlap).
 * - Empty strings are filtered out to avoid no-op Text nodes.
 */
export function tokenize(raw: string): InlineToken[] {
  const tokens: InlineToken[] = [];
  let lastIndex = 0;

  for (const match of raw.matchAll(EMOJI_PATTERN)) {
    const matchIndex = match.index;

    // Text before this emoji token.
    if (matchIndex > lastIndex) {
      tokens.push({ kind: 'text', value: raw.slice(lastIndex, matchIndex) });
    }

    const name = match[1];
    if (name !== undefined && name.length > 0) {
      tokens.push({ kind: 'emoji', name });
    }

    lastIndex = matchIndex + match[0].length;
  }

  // Trailing text after the last emoji.
  if (lastIndex < raw.length) {
    tokens.push({ kind: 'text', value: raw.slice(lastIndex) });
  }

  return tokens;
}
