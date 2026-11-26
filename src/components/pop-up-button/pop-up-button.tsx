"use client";

import { Select as BaseSelect } from "@base-ui/react/select";
import { Children, type ComponentProps, isValidElement, type ReactNode, type Ref } from "react";
import { cn, withClassName } from "../../lib/cn";
import type { ControlSize } from "../../lib/control-size";
// The open menu is the library's menu: its surface and its rows are drawn by these two
// components' stylesheets, on the classes this file puts on Base UI's Select parts.
import "../menu";
import "../menu-item";
import "./pop-up-button.tokens.css";
import "./pop-up-button.css";

export interface PopUpButtonBezelProps extends ComponentProps<"button"> {
  /**
   * AppKit control size.
   * @default "regular"
   */
  size?: ControlSize;
  /**
   * Whether the bezel is drawn. Without it the control is its title and the arrows.
   * @default true
   */
  bordered?: boolean;
  /**
   * The indicator in the cap: `"double"` for a pop-up button, whose menu extends both ways,
   * `"down"` for a button whose menu opens below it.
   * @default "double"
   */
  arrows?: "double" | "down";
  /** A 16 pt image drawn before the title: an icon or a colour chip. */
  image?: ReactNode;
}

export interface PopUpButtonProps<Value = string>
  extends Omit<BaseSelect.Trigger.Props, "ref" | "children" | "value" | "defaultValue"> {
  /** The selected item's value, when controlled. Use it with `onValueChange`. */
  value?: Value | null;
  /** The value selected at first, when uncontrolled. */
  defaultValue?: Value | null;
  /** Called with the new value when the user chooses an item. */
  onValueChange?: BaseSelect.Root.Props<Value>["onValueChange"];
  /** Whether the menu is open, when controlled. Use it with `onOpenChange`. */
  open?: boolean;
  /**
   * Whether the menu is open at first, when uncontrolled.
   * @default false
   */
  defaultOpen?: boolean;
  /** Called when the menu opens or closes. */
  onOpenChange?: BaseSelect.Root.Props<Value>["onOpenChange"];
  /** Name under which the value is submitted with a form, through a hidden input. */
  name?: string;
  /**
   * Whether a value must be chosen before the form is submitted.
   * @default false
   */
  required?: boolean;
  /**
   * Whether the menu opens but the value cannot be changed.
   * @default false
   */
  readOnly?: boolean;
  /**
   * AppKit control size.
   * @default "regular"
   */
  size?: ControlSize;
  /**
   * Whether the bezel is drawn. Without it the control is its title and the double arrow, as
   * in a table cell or inside a sentence.
   * @default true
   */
  bordered?: boolean;
  /**
   * The indicator in the cap: `"double"` for a menu that extends both ways from the selected
   * item, `"down"` for the single chevron of a control whose menu opens below it, as the
   * pictures of a reminder.
   * @default "double"
   */
  arrows?: "double" | "down";
  /** Shown in place of the title while no item is selected. */
  placeholder?: ReactNode;
  /** The menu: `PopUpButtonItem` and `PopUpButtonSeparator` elements. */
  children?: ReactNode;
  /** Ref to the button. */
  ref?: Ref<HTMLButtonElement>;
}

export interface PopUpButtonItemProps extends Omit<BaseSelect.Item.Props, "ref"> {
  /**
   * A 16 pt image drawn before the title, in the menu and in the button while the item is
   * selected: an icon or a colour chip.
   */
  image?: ReactNode;
  /** Ref to the item's element. */
  ref?: Ref<HTMLDivElement>;
}

export interface PopUpButtonSeparatorProps extends Omit<BaseSelect.Separator.Props, "ref"> {
  /** Ref to the separator's element. */
  ref?: Ref<HTMLDivElement>;
}

/* The arrows, drawn for this library on the measured boxes (spec: pop-up-button and
   pull-down-button, coverage masks): chevrons with 45 degree arms and butt ends in the cap's
   box, whose origin is the corner of the cap's edge. Regular: 16.5 x 20 pt, stroke 1.3 (the
   spec's fit gives 1.2; 1.3 reproduces the mask's coverage), ink
   from x 4.5 to 12 and y 4 to 16. Small: 14.5 x 17 pt, stroke 1.2, ink from x 4 to 10.5 and
   y 3.5 to 13.5. Mini is not in any screenshot: 12.5 x 14 pt, the small drawing scaled. `heavy`
   is the 7 x 4.5 pt chevron that follows the title of a pull-down button without a bezel: arms
   of 3 pt, a stroke of 1.43 with round ends and a round corner (pop-up-button.css), a
   least-squares fit to the chevron of Books' Sort By button, which has the same coverage row
   by row as the one of the Trackpad and Mouse panes. Each
   entry: view box, double arrow, down arrow, stroke width. */
const ARROWS: Record<ControlSize | "heavy", [string, string, string, number]> = {
  regular: [
    "0 0 16.5 20",
    "M4.85 8.15l3.4-3.35 3.4 3.35M4.85 11.85l3.4 3.35 3.4-3.35",
    "M4.85 8.35l3.4 3.35 3.4-3.35",
    1.3,
  ],
  small: [
    "0 0 14.5 17",
    "M4.35 7.15l2.9-2.9 2.9 2.9M4.35 9.85l2.9 2.9 2.9-2.9",
    "M4.35 7.05l2.9 2.9 2.9-2.9",
    1.2,
  ],
  mini: [
    "0 0 12.5 14",
    "M3.85 5.8l2.4-2.4 2.4 2.4M3.85 8.2l2.4 2.4 2.4-2.4",
    "M3.85 5.9l2.4 2.4 2.4-2.4",
    1,
  ],
  heavy: ["0 0 10 10", "", "M2 3.75l3 3 3-3", 1.43],
};

const imageOf = (image: ReactNode) =>
  image ? <span className="mac-pop-up-button-image">{image}</span> : null;

/**
 * The bezel of a pop-up button as a plain `<button>`: the push button bezel with the accent
 * cap and its arrows. `PopUpButton` and the pull-down button are made of it; use it yourself
 * as the trigger of another popup. It takes every `<button>` prop and opens nothing.
 */
export function PopUpButtonBezel({
  size = "regular",
  bordered = true,
  arrows = "double",
  image,
  className,
  children,
  ...props
}: PopUpButtonBezelProps) {
  const down = arrows === "down";
  const [viewBox, double, single, strokeWidth] = ARROWS[down && !bordered ? "heavy" : size];
  return (
    <button
      type="button"
      data-size={size}
      data-bordered={bordered ? undefined : "false"}
      data-arrows={arrows}
      data-disabled={props.disabled ? "" : undefined}
      className={cn("mac-pop-up-button", className)}
      {...props}
    >
      <span className="mac-pop-up-button-title">
        {imageOf(image)}
        {children}
      </span>
      <span className="mac-pop-up-button-cap" aria-hidden="true">
        <svg viewBox={viewBox} aria-hidden="true" focusable="false">
          <path
            d={down ? single : double}
            fill="none"
            stroke="currentColor"
            strokeWidth={strokeWidth}
          />
        </svg>
      </span>
    </button>
  );
}

type ItemLike = { value?: unknown; image?: ReactNode; children?: ReactNode };
type Title = [image: ReactNode, label: ReactNode];

/* The image and title of every item among the children, by value: what the button shows while
   that item is selected, also before the menu has ever been opened and on the server. */
function collectTitles(children: ReactNode, titles: Map<unknown, Title>) {
  Children.forEach(children, (child) => {
    if (!isValidElement<ItemLike>(child)) return;
    const { value, image, children: label } = child.props;
    if (child.type === PopUpButtonItem) titles.set(value, [image, label]);
    else collectTitles(label, titles);
  });
}

/**
 * A Catalina pop-up button (NSPopUpButton): shows the current choice from a list of mutually
 * exclusive items, and opens a menu over itself with that item under the pointer.
 *
 * Built on Base UI's Select. The props listed here configure the selection; every other prop,
 * `id`, `aria-label`, `className`, `style` and `ref` included, goes to the button. It has no
 * visible label of its own: put a label beside it and name the button with `aria-label` or
 * `aria-labelledby`.
 */
export function PopUpButton<Value = string>({
  value,
  defaultValue,
  onValueChange,
  open,
  defaultOpen = false,
  onOpenChange,
  name,
  required = false,
  readOnly = false,
  disabled,
  size = "regular",
  bordered = true,
  arrows = "double",
  placeholder,
  className,
  children,
  ref,
  ...props
}: PopUpButtonProps<Value>) {
  const titles = new Map<unknown, Title>();
  collectTitles(children, titles);
  return (
    <BaseSelect.Root<Value>
      value={value}
      defaultValue={defaultValue}
      onValueChange={onValueChange}
      open={open}
      defaultOpen={defaultOpen}
      onOpenChange={onOpenChange}
      name={name}
      required={required}
      readOnly={readOnly}
      disabled={disabled}
    >
      <BaseSelect.Trigger
        render={<PopUpButtonBezel size={size} bordered={bordered} arrows={arrows} />}
        className={className}
        ref={ref}
        {...props}
      >
        {/* The image is outside the title's Select.Value: Base UI lays the selected item's text
            over the value's text, and an item's text does not include its image either. */}
        <BaseSelect.Value>
          {(selected: Value | null) => imageOf(titles.get(selected)?.[0])}
        </BaseSelect.Value>
        <BaseSelect.Value>
          {(selected: Value | null) =>
            titles.has(selected)
              ? titles.get(selected)?.[1]
              : selected == null
                ? placeholder
                : String(selected)
          }
        </BaseSelect.Value>
      </BaseSelect.Trigger>
      <BaseSelect.Portal>
        <BaseSelect.Positioner className="mac-menu-positioner">
          <BaseSelect.Popup className="mac-menu mac-pop-up-button-menu" data-size={size}>
            {children}
          </BaseSelect.Popup>
        </BaseSelect.Positioner>
      </BaseSelect.Portal>
    </BaseSelect.Root>
  );
}

/**
 * One choice in a pop-up button's menu. Built on Base UI's Select.Item: `value` identifies it,
 * `disabled` dims it, and its children are its title, in the menu and in the button.
 */
export function PopUpButtonItem({ image, className, children, ...props }: PopUpButtonItemProps) {
  return (
    <BaseSelect.Item className={withClassName("mac-menu-item", className)} {...props}>
      {image ? (
        <span className="mac-menu-item-image mac-pop-up-button-item-image">{image}</span>
      ) : null}
      <BaseSelect.ItemText className="mac-menu-item-title">{children}</BaseSelect.ItemText>
    </BaseSelect.Item>
  );
}

/** A separator line between groups of items in a pop-up button's menu. */
export function PopUpButtonSeparator({ className, ...props }: PopUpButtonSeparatorProps) {
  return (
    <BaseSelect.Separator
      className={withClassName("mac-menu-item-separator", className)}
      {...props}
    />
  );
}
