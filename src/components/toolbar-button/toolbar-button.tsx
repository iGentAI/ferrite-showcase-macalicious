"use client";

import { Button as BaseButton } from "@base-ui/react/button";
import { Toggle as BaseToggle } from "@base-ui/react/toggle";
import { Toolbar as BaseToolbar } from "@base-ui/react/toolbar";
import { type Ref, use } from "react";
import { withClassName } from "../../lib/cn";
import { ToolbarContext } from "../../lib/toolbar-context";
import "./toolbar-button.tokens.css";
import "./toolbar-button.css";

export interface ToolbarButtonProps extends Omit<BaseButton.Props, "ref"> {
  /**
   * Makes the button a toggle and controls it: `true` draws the dark "on" bezel and sets
   * `aria-pressed`. A button with neither `pressed` nor `defaultPressed` is momentary, which
   * is what the Human Interface Guidelines ask of nearly every toolbar button.
   */
  pressed?: boolean;
  /** Makes the button a toggle that keeps its own state, starting on or off. */
  defaultPressed?: boolean;
  /** Called when a toggle is switched, with the new state. */
  onPressedChange?: (pressed: boolean) => void;
  /**
   * How a toggle shows that it is on. `"bezel"` darkens the whole bezel, as Finder's view
   * buttons and Safari's sidebar button do. `"tint"` keeps the plain bezel and colours the
   * glyph, as Console's Now and Info buttons do; in an inactive window the glyph is grey like
   * any other. It changes nothing on a button that is not a toggle.
   * @default "bezel"
   */
  pressedStyle?: "bezel" | "tint";
  /**
   * What the button's box is. `"fill"` is the bezel's fill in both appearances: Aqua's
   * hairline border is drawn outside the box. `"bezel"` adds that border to the box, so in
   * Aqua the button takes one hairline more on each side and in Dark Aqua, which has no
   * border, nothing: buttons laid out with the same gap then stand where Keychain Access has
   * them in both appearances.
   * @default "fill"
   */
  frame?: "fill" | "bezel";
  /** Ref to the rendered element. */
  ref?: Ref<HTMLElement>;
}

/**
 * The push button of a toolbar (NSButton with the textured rounded bezel): a 22 pt bezel that
 * holds a glyph or a short title and acts immediately when clicked.
 *
 * Built on Base UI's Button, or its Toggle when `pressed` or `defaultPressed` is given. Inside
 * a `Toolbar` it joins the toolbar's arrow-key navigation; it also works on its own. A button
 * that shows only a glyph needs an `aria-label`.
 */
export function ToolbarButton({
  pressed,
  defaultPressed,
  onPressedChange,
  pressedStyle = "bezel",
  frame = "fill",
  render,
  className,
  ...props
}: ToolbarButtonProps) {
  const inToolbar = use(ToolbarContext);
  const rest = {
    className: withClassName("mac-toolbar-button", className),
    // Only the looks that are not the default are marked, so a plain button's markup is short.
    "data-pressed-style": pressedStyle === "tint" ? "tint" : undefined,
    "data-frame": frame === "bezel" ? "bezel" : undefined,
    ...props,
  };
  // A caller's `render` is the innermost element: the toggle renders it, and the toolbar
  // renders the toggle, so a toggle drawn as another element still toggles.
  const toggle =
    pressed !== undefined || defaultPressed !== undefined ? (
      <BaseToggle
        pressed={pressed}
        defaultPressed={defaultPressed}
        onPressedChange={onPressedChange}
        render={render as BaseToggle.Props["render"]}
        {...((inToolbar ? { nativeButton: props.nativeButton } : rest) as BaseToggle.Props)}
      />
    ) : undefined;

  if (inToolbar) {
    return (
      <BaseToolbar.Button
        render={(toggle ?? render) as BaseToolbar.Button.Props["render"]}
        {...(rest as BaseToolbar.Button.Props)}
      />
    );
  }
  return toggle ?? <BaseButton render={render} {...rest} />;
}
