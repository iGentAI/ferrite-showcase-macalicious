"use client";

import { Menu as BaseMenu } from "@base-ui/react/menu";
import type { ReactNode, Ref } from "react";
import { cn } from "../../lib/cn";
import { MenuPopup } from "../menu";
import { PopUpButton, type PopUpButtonProps } from "../pop-up-button";
import { ToolbarButton, type ToolbarButtonProps } from "../toolbar-button";
import {
  ToolbarSegment,
  ToolbarSegmentedControl,
  type ToolbarSegmentProps,
} from "../toolbar-segmented-control";
import "./toolbar-pop-up.css";

/* The down chevron, drawn for this library on the measured box (spec: toolbar-pop-up, Chevron):
   7.5 x 4.5 pt, stroke 1.5, square ends. */
const arrow = (
  <svg
    className="mac-toolbar-pop-up-arrow"
    viewBox="0 0 7.5 4.5"
    aria-hidden="true"
    focusable="false"
  >
    <path d="M.75.75l3 3 3-3" fill="none" stroke="currentColor" strokeWidth="1.5" />
  </svg>
);

/* The small heavy chevron of the split button's menu part (Preview's Highlight button): 7 x
   4.5 pt, stroke 1.75. */
const heavyArrow = (
  <svg
    className="mac-toolbar-pop-up-arrow"
    viewBox="0 0 7 4.5"
    aria-hidden="true"
    focusable="false"
  >
    <path d="M.87.87L3.5 3.5 6.13.87" fill="none" stroke="currentColor" strokeWidth="1.75" />
  </svg>
);

// What Base UI hands a trigger's `render` function: the props to spread, and the popup's state.
type TriggerProps = ToolbarButtonProps & { "data-pressed"?: string };

/* The trigger of either kind: a toolbar button with the chevron after its content. While its
   menu is open it takes the toolbar button's "on" bezel, which that component draws for
   data-pressed. */
function trigger({ className, children, ...props }: TriggerProps, state: { open: boolean }) {
  return (
    <ToolbarButton
      {...props}
      className={cn("mac-toolbar-pop-up", className as string)}
      data-pressed={state.open ? "" : undefined}
    >
      {children}
      {arrow}
    </ToolbarButton>
  );
}

const imageOf = (image: ReactNode) =>
  image != null && <span className="mac-toolbar-pop-up-image">{image}</span>;

export interface ToolbarPullDownProps
  extends Omit<BaseMenu.Trigger.Props, "ref" | "title" | "children" | "render"> {
  /**
   * The glyph in the button: a template image about 14 pt high, drawn with `currentColor`,
   * such as the Action gear. A button with only an image needs an `aria-label`.
   */
  image?: ReactNode;
  /** A title, after the image or in its place. It names the menu and never changes. */
  title?: ReactNode;
  /**
   * The narrow form Preview's View button has: 5 pt before the content in place of 10 pt, and
   * the chevron 4 pt after it in place of 9.5 pt, so a button with a 15 pt glyph is 36 pt wide
   * where the regular one is 46 pt with a 14 pt glyph.
   * @default false
   */
  compact?: boolean;
  /** Whether the menu is open, when controlled. Use it with `onOpenChange`. */
  open?: boolean;
  /**
   * Whether the menu is open at first, when uncontrolled.
   * @default false
   */
  defaultOpen?: boolean;
  /** Called when the menu opens or closes. */
  onOpenChange?: BaseMenu.Root.Props["onOpenChange"];
  /** The menu: `MenuItem`, `MenuSeparator` and the other parts of `macalicious/menu-item`. */
  children?: ReactNode;
  /** Ref to the button. */
  ref?: Ref<HTMLElement>;
}

/**
 * A pull-down button of a toolbar (NSPopUpButton, textured rounded, `pullsDown`): a toolbar
 * button with a glyph or a title and a down chevron, which opens a menu of commands below
 * itself. Finder's Group and Action buttons are this control.
 *
 * Built on Base UI's Menu: the button is its trigger, drawn as a `ToolbarButton`, and the
 * children are the items of the library's menu. The props listed here configure the menu;
 * every other prop, `aria-label`, `disabled`, `className`, `style` and `ref` included, goes to
 * the button. Inside a `Toolbar` it joins the toolbar's arrow-key navigation.
 */
export function ToolbarPullDown({
  image,
  title,
  compact = false,
  open,
  defaultOpen = false,
  onOpenChange,
  children,
  ...props
}: ToolbarPullDownProps) {
  return (
    <BaseMenu.Root open={open} defaultOpen={defaultOpen} onOpenChange={onOpenChange}>
      <BaseMenu.Trigger
        render={trigger}
        data-compact={compact ? "" : undefined}
        {...(props as BaseMenu.Trigger.Props)}
      >
        {imageOf(image)}
        {title != null && <span>{title}</span>}
      </BaseMenu.Trigger>
      <MenuPopup>{children}</MenuPopup>
    </BaseMenu.Root>
  );
}

export interface ToolbarPopUpProps<Value = string>
  extends Omit<PopUpButtonProps<Value>, "size" | "bordered" | "render"> {
  /**
   * The narrow form: 5 pt before the content in place of 10 pt, and the chevron 4 pt after it
   * in place of 9.5 pt, as on Preview's View button.
   * @default false
   */
  compact?: boolean;
}

/**
 * A pop-up button of a toolbar (NSPopUpButton, textured rounded): a toolbar button that shows
 * the current choice, with its image if it has one, and a down chevron, and opens the menu of
 * choices over itself.
 *
 * It is a `PopUpButton` drawn as a `ToolbarButton` and takes that component's props, without
 * `size` and `bordered`; the children are `PopUpButtonItem` and `PopUpButtonSeparator`
 * elements from `macalicious/pop-up-button`. Name it with `aria-label`.
 */
export function ToolbarPopUp<Value = string>({
  compact = false,
  ...props
}: ToolbarPopUpProps<Value>) {
  return (
    <PopUpButton<Value>
      {...props}
      data-compact={compact ? "" : undefined}
      render={trigger as PopUpButtonProps["render"]}
    />
  );
}

export interface ToolbarSplitPullDownProps
  extends Omit<ToolbarSegmentProps, "title" | "children" | "value" | "pressed" | "defaultPressed"> {
  /** The glyph of the main part: a template image drawn with `currentColor`. */
  image?: ReactNode;
  /** A title for the main part, after the image or in its place. */
  title?: ReactNode;
  /** Accessible name of the part that opens the menu, for example "Highlight colors". */
  menuLabel: string;
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
   * Whether both parts are disabled.
   * @default false
   */
  disabled?: boolean;
  /** The menu: `MenuItem`, `MenuSeparator` and the other parts of `macalicious/menu-item`. */
  children?: ReactNode;
}

/**
 * A split button of a toolbar: a main part that acts when clicked and a narrow part with a
 * down chevron that opens a menu, in one bezel with a divider between them (Preview's
 * Highlight button).
 *
 * The two parts are the segments of a momentary `ToolbarSegmentedControl`; the narrow one is
 * the trigger of a Base UI Menu. `onClick`, `aria-label` and the other button props go to the
 * main part.
 */
export function ToolbarSplitPullDown({
  image,
  title,
  menuLabel,
  open,
  defaultOpen = false,
  onOpenChange,
  disabled = false,
  className,
  children,
  ...props
}: ToolbarSplitPullDownProps) {
  return (
    <ToolbarSegmentedControl
      tracking="momentary"
      disabled={disabled}
      className={cn("mac-toolbar-pop-up-split", className as string)}
    >
      <ToolbarSegment {...props}>
        {imageOf(image)}
        {title}
      </ToolbarSegment>
      <BaseMenu.Root open={open} defaultOpen={defaultOpen} onOpenChange={onOpenChange}>
        <BaseMenu.Trigger
          aria-label={menuLabel}
          disabled={disabled}
          render={(triggerProps, state) => (
            <ToolbarSegment
              {...triggerProps}
              className={cn("mac-toolbar-pop-up-menu-part", triggerProps.className as string)}
              data-pressed={state.open ? "" : undefined}
            >
              {heavyArrow}
            </ToolbarSegment>
          )}
        />
        <MenuPopup align="end">{children}</MenuPopup>
      </BaseMenu.Root>
    </ToolbarSegmentedControl>
  );
}
