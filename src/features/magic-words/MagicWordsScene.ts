/**
 * @file Magic Words — full feature scene.
 *
 * Flow:
 *  1. init()  — set up chrome (bg, chat area, back button, loading label).
 *  2. enter() — fire async fetch; when data arrives load all emoji textures,
 *               then start the reveal timer.
 *  3. Reveal  — every MESSAGE_REVEAL_MS a new BubbleView fades in and the
 *               chat area scrolls up when bubbles fill the viewport.
 *  4. exit()  — cancel the reveal timer and any in-flight tweens.
 *
 * Alignment rule:
 *  - First unique character name seen → LEFT side.
 *  - All other names → RIGHT side.
 */

import { Container, Graphics, Text, TextStyle, Texture } from 'pixi.js';
import type { Scene } from '../../core/lifecycle/Scene';
import type { AppContext } from '../../types/index';
import { TweenManager, easeOutQuad } from '../../core/lifecycle/TweenManager';
import { Button } from '../../ui/components/Button';
import { Typography } from '../../ui/theme/Theme';
import { AppConfig } from '../../app/config/AppConfig';
import { fetchMagicWords } from './api';
import type { MagicWordsResponse, DialogueLine } from './types';
import { tokenize } from './tokenizer';
import { BubbleView } from './views/BubbleView';

// ---------------------------------------------------------------------------
// Layout constants
// ---------------------------------------------------------------------------

const CHAT_PADDING = 16;       // horizontal padding inside the chat area
const BUBBLE_GAP_SAME = 6;     // gap between bubbles from the same sender
const BUBBLE_GAP_DIFF = 14;    // gap between bubbles from different senders
const BUTTON_H = 80;           // space reserved at the bottom for the back button
const MESSAGE_REVEAL_MS = 1500; // delay between each bubble appearing

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Load a Texture from `primaryUrl`; on failure try `fallbackUrl`.
 * Returns Texture.EMPTY if both fail.
 */
const ASSET_TIMEOUT_MS = 3000;

async function _loadWithFallback(primaryUrl: string, fallbackUrl: string): Promise<Texture> {
  const load = (url: string): Promise<Texture> =>
    new Promise((resolve) => {
      const img = new Image();
      img.crossOrigin = 'anonymous';
      // Hard timeout — prevents hanging on blocked ports (e.g. port 81 from API).
      const timer = window.setTimeout(() => {
        img.src = '';      // abort the pending request
        resolve(Texture.EMPTY);
      }, ASSET_TIMEOUT_MS);
      img.onload = () => { clearTimeout(timer); resolve(Texture.from(img)); };
      img.onerror = () => { clearTimeout(timer); resolve(Texture.EMPTY); };
      img.src = url;
    });
  const tex = await load(primaryUrl);
  return tex !== Texture.EMPTY ? tex : load(fallbackUrl);
}

// ---------------------------------------------------------------------------
// MagicWordsScene
// ---------------------------------------------------------------------------

export class MagicWordsScene implements Scene {
  public readonly id = 'magic-words' as const;
  public readonly root: Container;
  public readonly tweens: TweenManager;

  private _ctx!: AppContext;

  private _bg!: Graphics;
  private _chatArea!: Container;   // scrollable: contains all BubbleView children
  private _chatMask!: Graphics;    // rectangular clip mask for the chat area
  private _statusLabel!: Text;     // "Loading…" / error message
  private _backBtn!: Button;
  private _retryBtn!: Button;      // shown only on load failure
  private _typingIndicator!: Container; // three bouncing dots

  private _width = 800;
  private _height = 600;

  // Reveal state
  private _dialogue: DialogueLine[] = [];
  private _emojiMap: Map<string, Texture> = new Map<string, Texture>();
  private _avatarTextureMap: Map<string, Texture> = new Map<string, Texture>();  // name → preloaded texture
  private _revealIndex = 0;
  private _revealAcc = 0;
  private _isRevealing = false;
  private _nextBubbleY = 0;   // Y cursor inside _chatArea
  private _prevSenderName: string | null = null; // tracks grouping and showName
  /** position map from API: character name → 'left' | 'right' */
  private _positionMap: Map<string, 'left' | 'right'> = new Map<string, 'left' | 'right'>();
  // Fallback heuristic: first character seen → left (used when API omits position)
  private _leftName: string | null = null;

  // Abort flag — set in exit() to stop async callbacks after scene leaves
  private _destroyed = false;
  private _typingTime = 0;

  public constructor() {
    this.root = new Container();
    this.tweens = new TweenManager();
  }

  // ---------------------------------------------------------------------------
  // Lifecycle
  // ---------------------------------------------------------------------------

  public init(ctx: AppContext): void {
    this._ctx = ctx;

    // Background
    this._bg = new Graphics();
    this.root.addChild(this._bg);

    // Scrollable chat area + mask
    this._chatArea = new Container();
    this._chatMask = new Graphics();
    this._chatArea.mask = this._chatMask;
    this.root.addChild(this._chatMask);
    this.root.addChild(this._chatArea);

    // Status / loading label
    this._statusLabel = new Text({
      text: 'Loading…',
      style: new TextStyle({
        fontFamily: Typography.FONT_FAMILY_PRIMARY,
        fontSize: Typography.SIZE_MD,
        fill: 0xffffff,
        align: 'center',
      }),
    });
    this._statusLabel.anchor.set(0.5);
    this.root.addChild(this._statusLabel);

    // Back button
    this._backBtn = new Button({
      label: '← Back to Menu',
      onClick: () => {
        void import('../../scenes/MenuScene').then(({ MenuScene }) => {
          this._ctx.sceneManager.go(new MenuScene());
        });
      },
    });
    this.root.addChild(this._backBtn.view);

    // Retry button — hidden until a load error occurs.
    this._retryBtn = new Button({
      label: 'Retry',
      width: 180,
      height: 48,
      onClick: () => {
        this._retryBtn.view.visible = false;
        this._statusLabel.text = 'Loading…';
        this._statusLabel.visible = true;
        // Reset reveal state before retrying.
        this._revealIndex = 0;
        this._revealAcc = 0;
        this._nextBubbleY = 0;
        this._prevSenderName = null;
        this._chatArea.removeChildren();
        this._chatArea.y = 0;
        // Re-add typing indicator (was destroyed by removeChildren).
        this._chatArea.addChild(this._typingIndicator);
        void this._loadData();
      },
    });
    this._retryBtn.view.visible = false;
    this.root.addChild(this._retryBtn.view);

    // Typing indicator — lives inside chatArea so it scrolls with content.
    // Rendered as a small rounded bubble with 3 bouncing dots inside.
    this._typingIndicator = new Container();
    this._typingIndicator.visible = false;
    const tiBg = new Graphics();
    tiBg.roundRect(0, -8, 50, 24, 10);
    tiBg.fill({ color: 0x2b2f42 });
    tiBg.stroke({ width: 1, color: 0xffffff, alpha: 0.12 });
    this._typingIndicator.addChild(tiBg);
    for (let i = 0; i < 3; i++) {
      const dot = new Graphics();
      dot.circle(0, 0, 3.5);
      dot.fill({ color: 0x7a9cc0 });
      dot.x = 10 + i * 14;
      this._typingIndicator.addChild(dot);
    }
    this._chatArea.addChild(this._typingIndicator);
  }

  public enter(): void {
    this._destroyed = false;
    this._prevSenderName = null;
    void this._loadData();
  }

  public update(dt: number): void {
    this.tweens.update(dt);

    // Animate typing indicator dots (children[0] is the background, skip it).
    if (this._typingIndicator.visible) {
      this._typingTime += dt;
      for (let i = 1; i < this._typingIndicator.children.length; i++) {
        const dot = this._typingIndicator.children[i];
        if (dot) {
          const phase = (this._typingTime / 350 - (i - 1) * 0.28) * Math.PI * 2;
          dot.y = -Math.max(0, Math.sin(phase)) * 5;
        }
      }
    }

    if (!this._isRevealing) return;
    if (this._revealIndex >= this._dialogue.length) {
      this._isRevealing = false;
      return;
    }

    this._revealAcc += dt;
    if (this._revealAcc >= MESSAGE_REVEAL_MS) {
      this._revealAcc -= MESSAGE_REVEAL_MS;
      this._revealNextBubble();
    }
  }

  public resize(width: number, height: number): void {
    this._width = width;
    this._height = height;
    this._layout();
  }

  public exit(): void {
    this._destroyed = true;
    this._isRevealing = false;
    this.tweens.killAll();
  }

  public destroy(): void {
    this._destroyed = true;
    this._backBtn.destroy();
    this._retryBtn.destroy();
    this._dialogue = [];
    this._emojiMap.clear();
    this._avatarTextureMap.clear();
    this._positionMap.clear();
    this.root.destroy({ children: true });
  }

  // ---------------------------------------------------------------------------
  // Data loading
  // ---------------------------------------------------------------------------

  private async _loadData(): Promise<void> {
    let data: MagicWordsResponse;
    try {
      data = await fetchMagicWords();
    } catch {
      if (this._destroyed) return;
      this._statusLabel.text = 'Could not load dialogue.';
      this._retryBtn.view.visible = true;
      return;
    }

    if (this._destroyed) return;
    // Build avatar lookup: texture + position from API.
    const avatarLoads = data.avatars.map(async (av) => {
      const tex = await _loadWithFallback(
        av.url,
        `${import.meta.env.BASE_URL}assets/avatars/${av.name.toLowerCase()}.png`,
      );
      this._avatarTextureMap.set(av.name, tex);
      // Store position from API; default to 'left' if field is absent.
      const pos = av.position === 'right' ? 'right' : 'left';
      this._positionMap.set(av.name, pos);
    });
    await Promise.allSettled(avatarLoads);
    this._dialogue = data.dialogue;

    // Some dialogue characters may not appear in data.avatars (e.g. "Neighbour").
    // For those, attempt to load a local fallback image by name.
    const knownNames = new Set(data.avatars.map((av) => av.name));
    const extraNames = [...new Set(data.dialogue.map((l) => l.name))].filter(
      (n) => !knownNames.has(n),
    );
    const extraLoads = extraNames.map(async (name) => {
      const tex = await _loadWithFallback(
        `${import.meta.env.BASE_URL}assets/avatars/${name.toLowerCase()}.png`,
        `${import.meta.env.BASE_URL}assets/avatars/${name.toLowerCase()}.png`, // same — no remote URL available
      );
      this._avatarTextureMap.set(name, tex);
    });
    await Promise.allSettled(extraLoads);

    // Load all emoji textures in parallel using native Image loading
    // (emoji URLs may lack a .png extension, which confuses the Pixi parser).
    const emojiLoads = data.emojies.map(async (e) => {
      try {
        const tex = await _loadWithFallback(e.url, `${import.meta.env.BASE_URL}assets/emojis/${e.name.toLowerCase()}.png`);
        if (tex !== Texture.EMPTY) this._emojiMap.set(e.name, tex);
      } catch {
        // Emoji texture failed — BubbleView will use text fallback.
      }
    });
    await Promise.allSettled(emojiLoads);

    // Some dialogue lines reference emoji tokens that are not in data.emojies
    // (e.g. {win}, {affirmative}).  Auto-resolve them using DiceBear fun-emoji
    // with the token name as seed so they render as images instead of [text].
    const knownEmojiNames = new Set(data.emojies.map((e) => e.name));
    const extraEmojiNames = new Set<string>();
    for (const line of data.dialogue) {
      for (const token of tokenize(line.text)) {
        if (token.kind === 'emoji' && !knownEmojiNames.has(token.name)) {
          extraEmojiNames.add(token.name);
        }
      }
    }
    const extraEmojiLoads = [...extraEmojiNames].map(async (name) => {
      const seed = name.charAt(0).toUpperCase() + name.slice(1);
      const url = `https://api.dicebear.com/9.x/fun-emoji/png?seed=${seed}`;
      try {
        const tex = await _loadWithFallback(url, `${import.meta.env.BASE_URL}assets/emojis/${name.toLowerCase()}.png`);
        if (tex !== Texture.EMPTY) this._emojiMap.set(name, tex);
      } catch { /* ignore — inlineLayout falls back to [name] text */ }
    });
    await Promise.allSettled(extraEmojiLoads);

    // _destroyed may be set to true by exit() during the async awaits above.
    // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
    if (this._destroyed) return;

    // Hide loading label and start reveal.
    this._statusLabel.visible = false;
    this._revealIndex = 0;
    this._revealAcc = MESSAGE_REVEAL_MS; // trigger immediately on first update
    this._isRevealing = true;
  }

  // ---------------------------------------------------------------------------
  // Bubble reveal
  // ---------------------------------------------------------------------------

  private _revealNextBubble(): void {
    // Hide the typing indicator as soon as a new bubble appears.
    this._typingIndicator.visible = false;
    this._typingTime = 0;

    const line = this._dialogue[this._revealIndex];
    if (!line) return;
    this._revealIndex++;

    // Determine alignment: prefer explicit API position, fall back to heuristic.
    const apiPosition = this._positionMap.get(line.name);
    let alignRight: boolean;
    if (apiPosition !== undefined) {
      alignRight = apiPosition === 'right';
    } else {
      // Fallback: first character seen → left, all others → right.
      this._leftName ??= line.name;
      alignRight = line.name !== this._leftName;
    }

    // Grouping: hide name when sender is same as previous; use tighter gap.
    const showName = line.name !== this._prevSenderName;
    const gap = showName ? BUBBLE_GAP_DIFF : BUBBLE_GAP_SAME;

    // Responsive bubble width: 74% of available chat column.
    const maxBubbleW = Math.floor((this._width - CHAT_PADDING * 2) * 0.74);

    const tokens = tokenize(line.text);
    const avatarTex = this._avatarTextureMap.get(line.name);
    const bubble = new BubbleView(
      tokens,
      line.name,
      avatarTex,
      this._emojiMap,
      alignRight,
      0, // start transparent
      maxBubbleW,
      showName,
    );

    const startY = this._nextBubbleY + gap + 6; // +6 for pop-in slide
    // Flush right: right-aligned bubbles stick to the right edge of the chat column.
    bubble.x = alignRight
      ? this._width - CHAT_PADDING - bubble.totalWidth
      : CHAT_PADDING;
    bubble.y = startY;
    bubble.alpha = 0;
    bubble.scale.set(0.98);
    this._chatArea.addChildAt(bubble, this._chatArea.children.indexOf(this._typingIndicator));
    this._nextBubbleY += bubble.bubbleHeight + gap;
    this._prevSenderName = line.name;

    // Position typing indicator at the next slot, aligned to the upcoming speaker's side.
    if (this._revealIndex < this._dialogue.length) {
      const nextLine = this._dialogue[this._revealIndex];
      const nextPos  = nextLine ? this._positionMap.get(nextLine.name) : undefined;
      const nextRight = nextPos !== undefined
        ? nextPos === 'right'
        : nextLine !== undefined && nextLine.name !== (this._leftName ?? nextLine.name);
      const TI_W = 50; // typing indicator bubble width
      // 44 = AVATAR_D, 10 = AVATAR_MARGIN — mirrors BubbleView layout constants
      this._typingIndicator.x = nextRight
        ? this._width - CHAT_PADDING - TI_W - 44 - 10
        : CHAT_PADDING + 44 + 10;
      this._typingIndicator.y = this._nextBubbleY + BUBBLE_GAP_DIFF + 6;
      this._typingIndicator.visible = true;
    }

    // Pop-in: alpha + slide up 6px + scale 0.98 → 1.
    this.tweens.add({
      duration: AppConfig.MESSAGE_APPEAR_DURATION_MS,
      easing: easeOutQuad,
      onUpdate: (p) => {
        bubble.alpha = p;
        bubble.y = startY - 6 * p;
        bubble.scale.set(0.98 + 0.02 * p);
      },
      onComplete: () => {
        bubble.alpha = 1;
        bubble.y = startY - 6;
        bubble.scale.set(1);
      },
    });

    // Scroll up if content overflows the visible chat area height.
    const visibleH = this._height - BUTTON_H - CHAT_PADDING;
    const overflow = this._nextBubbleY - visibleH + 10;
    if (overflow > 0) {
      const startScrollY = this._chatArea.y;
      const targetY = -overflow;
      this.tweens.add({
        duration: 450,
        easing: easeOutQuad,
        onUpdate: (p) => {
          this._chatArea.y = startScrollY + (targetY - startScrollY) * p;
        },
        onComplete: () => { this._chatArea.y = targetY; },
      });
    }
  }

  // ---------------------------------------------------------------------------
  // Layout
  // ---------------------------------------------------------------------------

  private _layout(): void {
    this._bg.clear();
    this._bg.rect(0, 0, this._width, this._height);
    this._bg.fill({ color: 0x0f0f1a });

    const chatAreaH = this._height - BUTTON_H - CHAT_PADDING;
    this._chatMask.clear();
    this._chatMask.rect(0, CHAT_PADDING, this._width, chatAreaH);
    this._chatMask.fill({ color: 0xffffff });

    this._chatArea.x = 0;

    this._statusLabel.x = this._width / 2;
    this._statusLabel.y = this._height / 2 - 30;

    this._retryBtn.x = this._width / 2 - 90;
    this._retryBtn.y = this._height / 2 + 10;

    this._backBtn.x = this._width / 2 - 140;
    this._backBtn.y = this._height - 72;
  }
}
