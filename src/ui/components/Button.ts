/**
 * @file Reusable interactive button component.
 *
 * Built entirely with PixiJS primitives (Graphics + Text).
 * Supports hover and press states with visual feedback.
 * Emits a callback on click — no DOM event bubbling.
 *
 * Memory: call `destroy()` when the parent scene is destroyed to release
 * all event listeners and display objects.
 */

import { Container, Graphics, Text, FederatedPointerEvent, TextStyle } from 'pixi.js';
import { Colors, Typography, Spacing } from '@ui/theme/Theme';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface ButtonOptions {
  /** Button label text. */
  label: string;
  /** Width in pixels. Defaults to 280. */
  width?: number;
  /** Height in pixels. Defaults to 56. */
  height?: number;
  /** Callback invoked on pointer up (click/tap). */
  onClick: () => void;
}

// ---------------------------------------------------------------------------
// Button
// ---------------------------------------------------------------------------

/**
 * An interactive PixiJS button with hover and active states.
 *
 * Usage:
 * ```ts
 * const btn = new Button({ label: 'Ace of Shadows', onClick: () => sceneManager.go(aceScene) });
 * btn.x = 100;
 * btn.y = 200;
 * container.addChild(btn.view);
 * // ...cleanup:
 * btn.destroy();
 * ```
 */
export class Button {
  /** The root container — add this to your scene. */
  public readonly view: Container;

  private readonly _bg: Graphics;
  private readonly _label: Text;
  private readonly _width: number;
  private readonly _height: number;
  private readonly _onClick: () => void;

  private _isHovered = false;
  private _isPressed = false;

  // Bound event handlers — kept as references for clean removal.
  private readonly _onPointerOver: () => void;
  private readonly _onPointerOut: () => void;
  private readonly _onPointerDown: (e: FederatedPointerEvent) => void;
  private readonly _onPointerUp: (e: FederatedPointerEvent) => void;

  public constructor(options: ButtonOptions) {
    this._width = options.width ?? 280;
    this._height = options.height ?? 56;
    this._onClick = options.onClick;

    this.view = new Container();
    this.view.eventMode = 'static';
    this.view.cursor = 'pointer';

    // --- Background ---
    this._bg = new Graphics();
    this.view.addChild(this._bg);

    // --- Label ---
    const style = new TextStyle({
      fontFamily: Typography.FONT_FAMILY_PRIMARY,
      fontSize: Typography.SIZE_MD,
      fontWeight: 'bold',
      fill: Colors.BUTTON_TEXT,
    });

    this._label = new Text({ text: options.label, style });
    this._label.anchor.set(0.5);
    this._label.x = this._width / 2;
    this._label.y = this._height / 2;
    this.view.addChild(this._label);

    // --- Bind event handlers ---
    this._onPointerOver = this._handlePointerOver.bind(this);
    this._onPointerOut = this._handlePointerOut.bind(this);
    this._onPointerDown = this._handlePointerDown.bind(this);
    this._onPointerUp = this._handlePointerUp.bind(this);

    this.view.on('pointerover', this._onPointerOver);
    this.view.on('pointerout', this._onPointerOut);
    this.view.on('pointerdown', this._onPointerDown);
    this.view.on('pointerup', this._onPointerUp);

    // --- Initial render ---
    this._draw();
  }

  // ---------------------------------------------------------------------------
  // Public accessors
  // ---------------------------------------------------------------------------

  public get x(): number { return this.view.x; }
  public set x(value: number) { this.view.x = value; }

  public get y(): number { return this.view.y; }
  public set y(value: number) { this.view.y = value; }

  // ---------------------------------------------------------------------------
  // Lifecycle
  // ---------------------------------------------------------------------------

  /**
   * Remove all event listeners and destroy the display objects.
   * Must be called when the parent scene is destroyed.
   */
  public destroy(): void {
    this.view.off('pointerover', this._onPointerOver);
    this.view.off('pointerout', this._onPointerOut);
    this.view.off('pointerdown', this._onPointerDown);
    this.view.off('pointerup', this._onPointerUp);

    this.view.destroy({ children: true });
  }

  // ---------------------------------------------------------------------------
  // Drawing
  // ---------------------------------------------------------------------------

  private _draw(): void {
    const borderColor = this._isHovered ? Colors.BUTTON_BORDER_HOVER : Colors.BUTTON_BORDER;
    const bgColor = this._isHovered ? Colors.BUTTON_BG_HOVER : Colors.BUTTON_BG;
    const alpha = this._isPressed ? 0.7 : 1.0;
    const radius = Spacing.SM;

    this._bg.clear();
    this._bg.roundRect(0, 0, this._width, this._height, radius);
    this._bg.fill({ color: bgColor });
    this._bg.stroke({ color: borderColor, width: 2, alpha });

    this.view.alpha = alpha;
  }

  // ---------------------------------------------------------------------------
  // Event handlers
  // ---------------------------------------------------------------------------

  private _handlePointerOver(): void {
    this._isHovered = true;
    this._draw();
  }

  private _handlePointerOut(): void {
    this._isHovered = false;
    this._isPressed = false;
    this._draw();
  }

  private _handlePointerDown(_e: FederatedPointerEvent): void {
    this._isPressed = true;
    this._draw();
  }

  private _handlePointerUp(_e: FederatedPointerEvent): void {
    if (this._isPressed) {
      this._isPressed = false;
      this._draw();
      this._onClick();
    }
  }
}
