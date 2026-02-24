/**
 * @file Inline content layout utility.
 *
 * Takes a token array and a map of emoji textures, and lays out a Container
 * of PixiJS Text / Sprite nodes left-to-right with manual word-wrap.
 *
 * Word-wrap algorithm:
 *  - Walk tokens left-to-right, tracking cursorX and lineY.
 *  - Text tokens are split on spaces; each word is measured individually.
 *  - Emoji tokens occupy a fixed square of EMOJI_INLINE_SIZE px.
 *  - When a word or emoji would exceed maxWidth, advance to the next line.
 *
 * Returns a Container owning all child nodes, plus the measured total height.
 */

import { Container, Sprite, Text, TextStyle, Texture } from 'pixi.js';
import type { InlineToken } from './tokenizer';
import { AppConfig } from '@app/config/AppConfig';

// ---------------------------------------------------------------------------
// Module-level shared styles (allocated once, reused for all bubbles)
// ---------------------------------------------------------------------------

const TEXT_STYLE = new TextStyle({
  fontFamily: 'system-ui, -apple-system, sans-serif',
  fontSize: 14,
  fill: 0xffffff,
  lineHeight: 20,
});

const FALLBACK_STYLE = new TextStyle({
  fontFamily: 'system-ui, -apple-system, sans-serif',
  fontSize: 12,
  fill: 0xaaaaaa,
  fontStyle: 'italic',
});

const LINE_HEIGHT = 22;
const SPACE_WIDTH = 4; // px between inline items

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

export interface InlineLayoutResult {
  container: Container;
  /** Total height of the laid-out content in pixels. */
  height: number;
  /** Total width of the widest line in pixels. */
  width: number;
}

/**
 * Build an inline-laid-out Container from a token array.
 *
 * @param tokens    - Ordered array of text/emoji tokens.
 * @param emojiMap  - Resolved textures keyed by emoji name.
 * @param maxWidth  - Maximum line width in pixels before wrapping.
 */
// Shared text node used only for width measurement — never added to the stage.
// This avoids allocating a new node per word while still getting accurate metrics.
let _measureNode: Text | undefined;
function measureWord(word: string): number {
  _measureNode ??= new Text({ text: '', style: TEXT_STYLE });
  _measureNode.text = word;
  return _measureNode.width;
}

export function buildInlineLayout(
  tokens: InlineToken[],
  emojiMap: ReadonlyMap<string, Texture>,
  maxWidth: number,
): InlineLayoutResult {
  const container = new Container();

  let cursorX = 0;
  let lineY = 0;
  let maxLineWidth = 0;

  // Text segment accumulator: instead of one Text node per word we accumulate
  // words into a buffer and flush as a single Text node per line-segment.
  // This cuts text node count from ~N_words to ~N_lines_per_bubble.
  let segText = '';
  let segX = 0;

  function flushSeg(): void {
    if (segText === '') return;
    const node = new Text({ text: segText, style: TEXT_STYLE });
    node.x = segX;
    node.y = lineY;
    container.addChild(node);
    segText = '';
  }

  function newLine(): void {
    flushSeg();
    maxLineWidth = Math.max(maxLineWidth, cursorX);
    cursorX = 0;
    lineY += LINE_HEIGHT;
  }

  for (const token of tokens) {
    if (token.kind === 'emoji') {
      // Flush any pending text before placing the emoji.
      flushSeg();

      const texture = emojiMap.get(token.name);
      let node: Sprite | Text;
      let nodeWidth: number;

      if (texture !== undefined && texture !== Texture.EMPTY) {
        node = new Sprite(texture);
        node.width = AppConfig.EMOJI_INLINE_SIZE;
        node.height = AppConfig.EMOJI_INLINE_SIZE;
        nodeWidth = AppConfig.EMOJI_INLINE_SIZE;
      } else {
        node = new Text({ text: `[${token.name}]`, style: FALLBACK_STYLE });
        nodeWidth = node.width;
      }

      if (cursorX > 0 && cursorX + nodeWidth > maxWidth) newLine();
      node.x = cursorX;
      node.y = node instanceof Text
        ? lineY
        : lineY + (LINE_HEIGHT - AppConfig.EMOJI_INLINE_SIZE) / 2;
      container.addChild(node);
      cursorX += nodeWidth + SPACE_WIDTH;
      continue;
    }

    // Text token: measure word-by-word but accumulate into one Text per segment.
    const words = token.value.split(' ');
    for (const word of words) {
      if (word.length === 0) continue;

      // Measure via the shared singleton node — avoids allocating a new Text per word.
      const wordW = measureWord(word);

      if (cursorX > 0 && cursorX + wordW > maxWidth) {
        newLine(); // flushes current segment first
      }

      // Append word to current segment (space separator after first word on line).
      if (segText === '') {
        segX = cursorX;
        segText = word;
      } else {
        segText += ' ' + word;
      }
      cursorX += wordW + SPACE_WIDTH;
    }
  }

  // Flush any remaining text segment.
  flushSeg();
  maxLineWidth = Math.max(maxLineWidth, cursorX);

  return {
    container,
    height: lineY + LINE_HEIGHT,
    width: maxLineWidth,
  };
}
