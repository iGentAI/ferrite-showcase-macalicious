"use client";

import { Button as BaseButton } from "@base-ui/react/button";
import { Radio as BaseRadio } from "@base-ui/react/radio";
import { RadioGroup as BaseRadioGroup } from "@base-ui/react/radio-group";
import type { ComponentProps, Ref } from "react";
import { cn, withClassName } from "../../lib/cn";
import "./scope-bar.tokens.css";
import "./scope-bar.css";

export interface ScopeBarProps extends ComponentProps<"div"> {
  /**
   * The surface the bar is drawn on. `"plain"` is the flat 32 pt bar Finder shows above search
   * results; `"toolbar"` is the 31 pt bar on the toolbar gradient that Preview uses as its
   * find bar, with wider scopes and 18 pt action buttons.
   * @default "plain"
   */
  surface?: "plain" | "toolbar";
  /**
   * The height of the bar and the type of its scopes. `"small"` is the compact 23 pt bar
   * Console shows under its toolbar, with scopes in the 11 pt medium system font; on the
   * toolbar surface it has Console's fill, bottom rows and darker scope titles. There is no
   * mini bar.
   * @default "regular"
   */
  size?: "regular" | "small";
}

/**
 * A scope bar: the strip under the toolbar that narrows a search. Compose it from a
 * `ScopeBarLabel`, a `ScopeBarGroup` of `ScopeBarButton`s and, at the trailing edge,
 * `ScopeBarActions` holding `ScopeBarAction`s. Renders a `<div>` that fills its container's
 * width.
 */
export function ScopeBar({
  surface = "plain",
  size = "regular",
  className,
  ...props
}: ScopeBarProps) {
  return (
    <div
      data-surface={surface}
      data-size={size}
      className={cn("mac-scope-bar", className)}
      {...props}
    />
  );
}

export interface ScopeBarLabelProps extends ComponentProps<"span"> {}

/**
 * The bold label before the scopes ("Search:"). Give it an `id` and name the group with
 * `aria-labelledby`. Renders a `<span>`.
 */
export function ScopeBarLabel({ className, ...props }: ScopeBarLabelProps) {
  return <span className={cn("mac-scope-bar-label", className)} {...props} />;
}

export interface ScopeBarGroupProps extends Omit<BaseRadioGroup.Props, "ref"> {
  /** Ref to the rendered element, the one with `role="radiogroup"`. */
  ref?: Ref<HTMLDivElement>;
}

/**
 * The scopes: a single-selection group of `ScopeBarButton`s. Built on Base UI's Radio Group,
 * so it accepts `value`, `defaultValue`, `onValueChange`, `name`, `disabled` and `readOnly`.
 * It is one tab stop; the arrow keys move the selection.
 */
export function ScopeBarGroup({ className, ...props }: ScopeBarGroupProps) {
  return <BaseRadioGroup className={withClassName("mac-scope-bar-group", className)} {...props} />;
}

export interface ScopeBarButtonProps extends Omit<BaseRadio.Root.Props, "ref"> {
  /** Ref to the rendered element, the one with `role="radio"`. */
  ref?: Ref<HTMLElement>;
}

/**
 * One scope (AppKit's recessed bezel): plain bold text while off, a filled pill while on.
 * Built on Base UI's Radio, so it takes a `value` unique in its `ScopeBarGroup`, `disabled`
 * and `render`.
 */
export function ScopeBarButton({ className, ...props }: ScopeBarButtonProps) {
  return <BaseRadio.Root className={withClassName("mac-scope-bar-button", className)} {...props} />;
}

export interface ScopeBarActionsProps extends ComponentProps<"div"> {}

/** The trailing area of the bar, for `ScopeBarAction`s and other content. Renders a `<div>`. */
export function ScopeBarActions({ className, ...props }: ScopeBarActionsProps) {
  return <div className={cn("mac-scope-bar-actions", className)} {...props} />;
}

export interface ScopeBarActionGroupProps extends ComponentProps<"div"> {}

/**
 * Joins the `ScopeBarAction`s inside it into one segmented round-rect, like the previous and
 * next buttons of Preview's find bar. Renders a `<div role="group">`; name it with
 * `aria-label`.
 */
export function ScopeBarActionGroup({ className, ...props }: ScopeBarActionGroupProps) {
  return (
    // biome-ignore lint/a11y/useSemanticElements: a group of buttons, not a form fieldset
    <div role="group" className={cn("mac-scope-bar-action-group", className)} {...props} />
  );
}

export interface ScopeBarActionProps extends Omit<BaseButton.Props, "ref"> {
  /**
   * A glyph drawn before the children: the plus that adds a search criterion, a minus, or the
   * previous and next chevrons of a find bar. A button with only a glyph needs `aria-label`.
   */
  glyph?: "plus" | "minus" | "previous" | "next";
  /** Ref to the rendered element. */
  ref?: Ref<HTMLElement>;
}

/**
 * A round-rect scope button (AppKit's `roundRect` bezel) that starts an action, such as Save
 * and + in Finder's search bar. Built on Base UI's Button: accepts `disabled`,
 * `focusableWhenDisabled`, `render` and every native button attribute.
 */
export function ScopeBarAction({ glyph, className, children, ...props }: ScopeBarActionProps) {
  return (
    <BaseButton
      data-glyph={glyph}
      className={withClassName("mac-scope-bar-action", className)}
      {...props}
    >
      {glyph ? (
        <span data-glyph={glyph} className="mac-scope-bar-glyph" aria-hidden="true" />
      ) : null}
      {children}
    </BaseButton>
  );
}
