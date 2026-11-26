"use client";

import { Menu as BaseMenu } from "@base-ui/react/menu";
import type { ReactNode, Ref } from "react";
import { withClassName } from "../../lib/cn";
import type { ControlSize } from "../../lib/control-size";
import { MenuPopup } from "../menu";
import { PopUpButtonBezel } from "../pop-up-button";
import "./pull-down-button.tokens.css";
import "./pull-down-button.css";

export interface PullDownButtonProps
  extends Omit<BaseMenu.Trigger.Props, "ref" | "title" | "children"> {
  /**
   * The button's title (NSPopUpButton.title). It names the menu and does not change when an
   * item is chosen. A button without a title needs an `aria-label`.
   */
  title?: ReactNode;
  /** A 16 pt image drawn before the title, or in its place: a template icon such as a gear. */
  image?: ReactNode;
  /** Whether the menu is open, when controlled. Use it with `onOpenChange`. */
  open?: boolean;
  /**
   * Whether the menu is open at first, when uncontrolled.
   * @default false
   */
  defaultOpen?: boolean;
  /** Called when the menu opens or closes. */
  onOpenChange?: BaseMenu.Root.Props["onOpenChange"];
  /**
   * AppKit control size.
   * @default "regular"
   */
  size?: ControlSize;
  /**
   * Whether the bezel is drawn. Without it the control is its title followed by a small
   * chevron.
   * @default true
   */
  bordered?: boolean;
  /** The menu: `MenuItem`, `MenuSeparator` and the other parts of `macalicious/menu-item`. */
  children?: ReactNode;
  /** Ref to the button. */
  ref?: Ref<HTMLButtonElement>;
}

/**
 * A Catalina pull-down button (NSPopUpButton with `pullsDown`): a button with a fixed title
 * and one down chevron that opens a menu of commands below itself.
 *
 * Built on Base UI's Menu: the button is its trigger, drawn with the pop-up button's bezel,
 * and the children are the items of the library's menu. The props listed here configure the
 * menu; every other prop, `id`, `aria-label`, `disabled`, `className`, `style` and `ref`
 * included, goes to the button.
 */
export function PullDownButton({
  title,
  image,
  open,
  defaultOpen = false,
  onOpenChange,
  size = "regular",
  bordered = true,
  className,
  children,
  ref,
  ...props
}: PullDownButtonProps) {
  return (
    <BaseMenu.Root open={open} defaultOpen={defaultOpen} onOpenChange={onOpenChange}>
      <BaseMenu.Trigger
        render={<PopUpButtonBezel arrows="down" size={size} bordered={bordered} image={image} />}
        className={withClassName("mac-pull-down-button", className)}
        ref={ref}
        {...props}
      >
        {title}
      </BaseMenu.Trigger>
      <MenuPopup size={size} side="bottom" align="start">
        {children}
      </MenuPopup>
    </BaseMenu.Root>
  );
}
