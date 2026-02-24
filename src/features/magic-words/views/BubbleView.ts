/**
 * @file Chat message bubble view.
 *
 * Renders a single dialogue line as:
 *   [ Avatar circle ] [ Speech bubble with inline content ]
 *   or mirrored for the right-aligned variant.
 *
 * The avatar image loads asynchronously; a coloured placeholder disc is shown
 * immediately and replaced when the texture resolves.
 *
 * Layout:
 *   AVATAR_D px avatar circle
 *   AVATAR_MARGIN px gap
 *   Variable-width bubble (capped at MAX_BUBBLE_W)
 *   BUBBLE_PAD px internal padding on all sides
 */

import { Container, Graphics, Sprite, Text, TextStyle, Texture } from 'pixi.js';
import type { InlineToken } from '../tokenizer';
import { buildInlineLayout } from '../inlineLayout';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------


// ---------------------------------------------------------------------------
// Layout constants
// ---------------------------------------------------------------------------

const AVATAR_D = 44;           // avatar circle diameter
const AVATAR_R = AVATAR_D / 2; // radius
const AVATAR_MARGIN = 10;      // gap between avatar and bubble
const BUBBLE_PAD = 12;         // internal bubble padding
const BUBBLE_RADIUS = 14;      // bubble corner radius
const NAME_STYLE = new TextStyle({
  fontFamily: 'system-ui, -apple-system, sans-serif',
  fontSize: 10,
  fontWeight: 'bold',
  fill: 0x7a8494,  // muted — equivalent to 0x9aa3b2 at ~80% opacity on dark bg
});

// ---------------------------------------------------------------------------
// BubbleView
// ---------------------------------------------------------------------------

export class BubbleView extends Container {
  /** The total height of this bubble (used by the scene for layout). */
  public readonly bubbleHeight: number;
  /** Total width including avatar + margin (used by scene for right-flush x positioning). */
  public readonly totalWidth: number;

  public constructor(
    tokens: InlineToken[],
    characterName: string,
    avatarTexture: Texture | undefined,
    emojiMap: ReadonlyMap<string, Texture>,
    /** When true, the bubble is right-aligned (avatar on the right). */
    alignRight: boolean,
    /** Alpha on first frame — scene fades it in. */
    initialAlpha = 0,
    /** Max bubble content width — scene passes (chatWidth * 0.74) for responsive layout. */
    maxBubbleW = 340,
    /** Show the character name label above the bubble (false when sender is same as previous). */
    showName = true,
  ) {
    super();
    this.alpha = initialAlpha;

    // --- Inline content layout ---
    const content = buildInlineLayout(tokens, emojiMap, maxBubbleW);
    const bubbleW = Math.min(content.width + BUBBLE_PAD * 2, maxBubbleW + BUBBLE_PAD * 2);
    const bubbleH = content.height + BUBBLE_PAD * 2;

    // --- Alignment: avatar on outside, bubble on inside ---
    const bubbleX = alignRight ? 0 : AVATAR_D + AVATAR_MARGIN;
    const avatarX = alignRight ? bubbleW + AVATAR_MARGIN : 0;

    // --- Name label (conditional) ---
    let contentOffsetY = 0;
    if (showName) {
      const nameLabel = new Text({ text: characterName, style: NAME_STYLE });
      nameLabel.x = bubbleX;
      nameLabel.y = 0;
      this.addChild(nameLabel);
      contentOffsetY = nameLabel.height + 4;
    }

    // --- Bubble: shadow layer + fill + subtle border ---
    const bubbleFill = alignRight ? 0x2f5f90 : 0x2b2f42;

    const bubbleShadow = new Graphics();
    bubbleShadow.roundRect(0, 0, bubbleW, bubbleH, BUBBLE_RADIUS);
    bubbleShadow.fill({ color: 0x000000, alpha: 0.22 });
    bubbleShadow.x = bubbleX;
    bubbleShadow.y = contentOffsetY + 2; // offset creates depth
    this.addChild(bubbleShadow);

    const bubble = new Graphics();
    bubble.roundRect(0, 0, bubbleW, bubbleH, BUBBLE_RADIUS);
    bubble.fill({ color: bubbleFill, alpha: 0.98 });
    bubble.stroke({ width: 1, color: 0xffffff, alpha: 0.15 });
    bubble.x = bubbleX;
    bubble.y = contentOffsetY;
    this.addChild(bubble);

    content.container.x = bubbleX + BUBBLE_PAD;
    content.container.y = contentOffsetY + BUBBLE_PAD;
    this.addChild(content.container);

    // --- Avatar placeholder disc ---
    const disc = new Graphics();
    disc.circle(AVATAR_R, AVATAR_R, AVATAR_R);
    disc.fill({ color: this._nameToColor(characterName) });
    disc.x = avatarX;
    disc.y = contentOffsetY;
    this.addChild(disc);

    // Initial letter inside the disc as fallback.
    const initial = new Text({
      text: characterName[0]?.toUpperCase() ?? '?',
      style: new TextStyle({ fontFamily: 'sans-serif', fontSize: 16, fill: 0xffffff, fontWeight: 'bold' }),
    });
    initial.anchor.set(0.5);
    initial.x = avatarX + AVATAR_R;
    initial.y = contentOffsetY + AVATAR_R;
    this.addChild(initial);

    // Apply preloaded avatar texture directly (texture was resolved by the scene with fallback).
    if (avatarTexture !== undefined && avatarTexture !== Texture.EMPTY) {
      // DiceBear PNGs have alpha-transparent corners — no Graphics mask needed.
      // The disc behind provides the coloured background ring visible at the edges.
      const av = new Sprite(avatarTexture);
      av.width = AVATAR_D;
      av.height = AVATAR_D;
      av.x = avatarX;
      av.y = contentOffsetY;
      this.addChild(av);
      // Outline ring drawn as a separate circle on top.
      const outline = new Graphics();
      outline.circle(avatarX + AVATAR_R, contentOffsetY + AVATAR_R, AVATAR_R - 0.5);
      outline.stroke({ width: 1.5, color: 0xffffff, alpha: 0.18 });
      this.addChild(outline);
    }

    this.bubbleHeight = contentOffsetY + Math.max(bubbleH, AVATAR_D) + 8;
    this.totalWidth  = bubbleW + AVATAR_D + AVATAR_MARGIN;
  }

  // ---------------------------------------------------------------------------
  // Private helpers
  // ---------------------------------------------------------------------------

  /** Deterministic colour from a character name — uses a curated palette for consistent, clean colours. */
  private _nameToColor(name: string): number {
    const palette = [0x5b8def, 0x7c5cff, 0xff7a59, 0x2dd4bf, 0xb45309, 0xfb7185, 0x60a5fa, 0xa78bfa];
    let hash = 0;
    for (let i = 0; i < name.length; i++) hash = (hash * 31 + name.charCodeAt(i)) | 0;
    return palette[Math.abs(hash) % palette.length] ?? 0x5b8def;
  }
}
