"use client";

import { Popover as BasePopover } from "@base-ui/react/popover";
import {
  type ComponentProps,
  type CSSProperties,
  type ReactNode,
  useCallback,
  useRef,
} from "react";
import { cn, withClassName } from "../../lib/cn";
import { PushButton } from "../push-button";
import "./sheet.tokens.css";
import "./sheet.css";

// The kinds of field that take typing: an `<input>` of these types, or a `<textarea>`.
const TEXT = /^(text|search|email|url|tel|password|number|textarea)$/;

// Whether an element can take the focus now: enabled, focusable, not inert, visible and
// rendered. `checkVisibility` knows what is not rendered (`display: none`, a closed
// `<details>`, `content-visibility: hidden`, on the element or above it); where it is missing,
// the first two are looked for.
function usable(element: HTMLElement) {
  if (
    element.matches(":disabled") ||
    element.closest("[inert]") ||
    !(element.tabIndex >= 0 || element.hasAttribute("tabindex")) ||
    getComputedStyle(element).visibility !== "visible"
  ) {
    return false;
  }
  if (element.checkVisibility) return element.checkVisibility();
  for (let node: HTMLElement | null = element; node; node = node.parentElement) {
    const parent: HTMLElement | null = node.parentElement;
    if (
      getComputedStyle(node).display === "none" ||
      (parent instanceof HTMLDetailsElement &&
        !parent.open &&
        node !== parent.querySelector(":scope > summary"))
    ) {
      return false;
    }
  }
  return true;
}

// A sheet stays where it hangs: it never moves away from the edge of the viewport.
const STAY = { side: "none", align: "none" } as const;

export interface SheetProps extends Omit<BasePopover.Root.Props, "modal"> {
  /**
   * How the sheet holds the keyboard. `"trap-focus"` keeps the focus inside while the rest of
   * the page, other windows included, stays usable with the pointer, as a document-modal
   * sheet does. `true` also blocks the pointer everywhere else. A sheet is always modal.
   * @default "trap-focus"
   */
  modal?: true | "trap-focus";
  /**
   * Whether a click outside the sheet, or the focus leaving it, closes it. A sheet waits for
   * an answer, so this is off.
   * @default false
   */
  dismissible?: boolean;
}

/**
 * A Catalina sheet (NSWindow.beginSheet): a dialog attached to one window, hanging from the
 * bottom edge of its title bar or toolbar. Groups the parts: put a `SheetPopup`, and a
 * `SheetTrigger` if a button opens it, inside.
 *
 * Built on Base UI's Popover, whose positioner keeps the sheet attached while the window
 * moves, and takes its Root props: `open`, `defaultOpen`, `onOpenChange`. Only Escape and the
 * sheet's own buttons close it.
 */
export function Sheet({
  modal = "trap-focus",
  dismissible = false,
  onOpenChange,
  ...props
}: SheetProps) {
  return (
    <BasePopover.Root
      modal={modal || "trap-focus"}
      onOpenChange={(open, details) => {
        if (
          !open &&
          !dismissible &&
          (details.reason === "outside-press" || details.reason === "focus-out")
        ) {
          details.cancel();
          return;
        }
        onOpenChange?.(open, details);
      }}
      {...props}
    />
  );
}

export interface SheetTriggerProps extends BasePopover.Trigger.Props {}

/**
 * The button that opens the sheet. Renders a `<button>`; pass the real control with `render`
 * (`render={<PushButton />}`). The sheet still hangs from its `anchor`, not from this button.
 */
export function SheetTrigger(props: SheetTriggerProps) {
  return <BasePopover.Trigger {...props} />;
}

export interface SheetPopupProps extends BasePopover.Popup.Props {
  /**
   * What the sheet hangs from: the title bar (with its toolbar) of the window it belongs to,
   * as an element or a ref. The sheet's top edge follows that element's bottom edge and the
   * sheet is centred on it.
   */
  anchor: BasePopover.Positioner.Props["anchor"];
  /**
   * Width: a number of points, or any CSS length. It may be wider than the window. Sets
   * `--mac-sheet-width`; a `width` in `style` overrides it.
   */
  width?: number | string;
  /** Element the sheet is rendered into; the document body by default. */
  container?: BasePopover.Portal.Props["container"];
  /**
   * Keep the sheet in the DOM while it is closed.
   * @default false
   */
  keepMounted?: boolean;
}

/**
 * The sheet: a square-cornered panel of the sheet material with the standard 20 pt margins,
 * no title bar and a shadow on its sides and bottom only. It slides out from under the edge
 * it hangs from, takes the focus and keeps it inside. A sheet taller than the room below that
 * edge scrolls.
 *
 * It is a modal `dialog`: name it with a `SheetTitle` or an `aria-label`. When it opens, the
 * focus goes to the element marked `data-autofocus`, else to the first text field, else to
 * the sheet itself; `initialFocus` overrides that. Escape closes it, and Return activates the
 * `DefaultButton` inside.
 */
export function SheetPopup({
  anchor,
  width,
  container,
  keepMounted = false,
  initialFocus,
  className,
  ref,
  ...props
}: SheetPopupProps) {
  const popup = useRef<HTMLDivElement | null>(null);
  // The caller's ref gets the element too. A callback ref's cleanup, when it returns one, is
  // handed to React; otherwise React calls this again with null, which is passed on.
  const setPopup = useCallback(
    (element: HTMLDivElement | null) => {
      popup.current = element;
      if (typeof ref === "function") return ref(element);
      if (ref) ref.current = element;
    },
    [ref],
  );
  // The marked element, else the first text field, else the sheet itself, as in AppKit
  // without full keyboard access. Only what can take the focus is considered.
  const firstFocus = useCallback(() => {
    const sheet = popup.current;
    const candidates = Array.from(
      sheet?.querySelectorAll<HTMLElement>("[data-autofocus],input,textarea") ?? [],
    ).filter(usable);
    return (
      candidates.find((element) => element.hasAttribute("data-autofocus")) ??
      candidates.find((element) => TEXT.test((element as HTMLInputElement).type)) ??
      sheet
    );
  }, []);

  return (
    <BasePopover.Portal container={container} keepMounted={keepMounted}>
      <BasePopover.Positioner
        anchor={anchor}
        side="bottom"
        align="center"
        sideOffset={0}
        collisionAvoidance={STAY}
        className="mac-sheet-positioner"
        style={
          width === undefined
            ? undefined
            : ({
                "--mac-sheet-width": typeof width === "number" ? `${width}px` : width,
              } as CSSProperties)
        }
      >
        <BasePopover.Popup
          aria-modal="true"
          ref={setPopup}
          initialFocus={initialFocus ?? firstFocus}
          className={withClassName("mac-sheet", className)}
          {...props}
        />
      </BasePopover.Positioner>
    </BasePopover.Portal>
  );
}

export interface SheetTitleProps extends BasePopover.Title.Props {}

/**
 * The sheet's message, in bold: what it asks. It names the sheet for assistive technology.
 */
export function SheetTitle({ className, ...props }: SheetTitleProps) {
  return <BasePopover.Title className={withClassName("mac-sheet-title", className)} {...props} />;
}

export interface SheetDescriptionProps extends BasePopover.Description.Props {}

/** The smaller text under the message; assistive technology reads it as the description. */
export function SheetDescription({ className, ...props }: SheetDescriptionProps) {
  return (
    <BasePopover.Description
      className={withClassName("mac-sheet-description", className)}
      {...props}
    />
  );
}

export interface SheetActionsProps extends ComponentProps<"div"> {
  /**
   * Controls at the leading end of the row: a help button, or buttons that change the content
   * instead of dismissing the sheet.
   */
  leading?: ReactNode;
}

/**
 * The button row at the bottom of a sheet. Its children are the dismissing buttons, set at the
 * trailing end 12 pt apart with the action button last and Cancel before it; each is at least
 * `--mac-sheet-button-min-width` wide.
 */
export function SheetActions({ leading, className, children, ...props }: SheetActionsProps) {
  return (
    <div className={cn("mac-sheet-actions", className)} {...props}>
      {leading === undefined ? null : <div className="mac-sheet-actions-leading">{leading}</div>}
      <div className="mac-sheet-actions-trailing">{children}</div>
    </div>
  );
}

export interface SheetCloseProps extends BasePopover.Close.Props {}

/**
 * A button that closes the sheet: a push button unless `render` names another control
 * (`render={<DefaultButton />}` for the action button).
 */
export function SheetClose(props: SheetCloseProps) {
  return <BasePopover.Close render={<PushButton />} {...props} />;
}
