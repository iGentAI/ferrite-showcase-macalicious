"use client";

import { Dialog as BaseDialog } from "@base-ui/react/dialog";
import {
  type ComponentProps,
  type CSSProperties,
  type ReactNode,
  useCallback,
  useRef,
} from "react";
import { cn, withClassName } from "../../lib/cn";
import { PushButton } from "../push-button";
import { TitleBar, type TitleBarProps } from "../title-bar";
import { Window, WindowBody, type WindowState } from "../window";
import "./dialog.tokens.css";
import "./dialog.css";

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

// A `top` in `style` becomes `--mac-dialog-top`, which places the dialog and limits its height.
function place(style: CSSProperties | undefined) {
  if (style?.top === undefined) return style;
  const { top, ...rest } = style;
  return {
    ...rest,
    "--mac-dialog-top": typeof top === "number" ? `${top}px` : top,
  } as CSSProperties;
}

export interface DialogProps extends BaseDialog.Root.Props {
  /**
   * Whether a click outside the dialog leaves it open. Catalina never dismisses a dialog that
   * way, so this is on; switch it off for Base UI's behaviour.
   * @default true
   */
  disablePointerDismissal?: boolean;
}

/**
 * A Catalina dialog (an NSWindow or NSPanel run modally): a small window that asks for a
 * response. Groups the parts: put a `DialogPopup`, and a `DialogTrigger` if a button opens it,
 * inside.
 *
 * Built on Base UI's Dialog and takes its Root props: `open`, `defaultOpen`, `onOpenChange`,
 * and `modal` (`true` is app-modal, `false` a modeless panel that leaves the page usable).
 */
export function Dialog({ disablePointerDismissal = true, ...props }: DialogProps) {
  return <BaseDialog.Root disablePointerDismissal={disablePointerDismissal} {...props} />;
}

export interface DialogTriggerProps extends BaseDialog.Trigger.Props {}

/**
 * The button that opens the dialog. Renders a `<button>`; pass the real control with `render`
 * (`render={<PushButton />}`).
 */
export function DialogTrigger(props: DialogTriggerProps) {
  return <BaseDialog.Trigger {...props} />;
}

export interface DialogPopupProps extends Omit<BaseDialog.Popup.Props, "title"> {
  /**
   * The window title, centred in the title bar. It names the dialog for assistive technology;
   * a dialog without one needs an `aria-label`.
   */
  title?: ReactNode;
  /**
   * Window controls for the title bar: a `WindowControls` element. An app-modal dialog has
   * none; a modeless one usually has its zoom button disabled.
   */
  controls?: ReactNode;
  /**
   * The window state the frame is drawn in. A modal dialog is the key window while it is open.
   * A modeless one stays open while another window has the keyboard: a window manager passes
   * `"inactive"` then, and the title bar, the window controls and the default button lose
   * their key look.
   * @default "key"
   */
  state?: WindowState;
  /**
   * Called when the primary pointer button goes down on the title bar itself, not on a window
   * control in it. A window manager starts moving the dialog here. A handler on the window
   * that cancels the press first, in the capture phase, keeps it from being reported.
   * @default undefined
   */
  onDragRegionPointerDown?: TitleBarProps["onDragRegionPointerDown"];
  /**
   * Called when the title bar itself is double-clicked.
   * @default undefined
   */
  onDragRegionDoubleClick?: TitleBarProps["onDragRegionDoubleClick"];
  /** Frame width: a number of points, or any CSS length. Without it the content decides. */
  width?: number | string;
  /** Element the dialog is rendered into; the document body by default. */
  container?: BaseDialog.Portal.Props["container"];
  /**
   * Keep the dialog in the DOM while it is closed.
   * @default false
   */
  keepMounted?: boolean;
}

/**
 * The dialog window: a window frame with a 22 pt title bar and a body with the standard 20 pt
 * margins. It is rendered in a portal only while open, takes the focus and keeps it inside. A
 * dialog taller than the viewport scrolls its body.
 *
 * When it opens, the focus goes to the element marked `data-autofocus`, else to the first text
 * field, else to the window itself; `initialFocus` overrides that. Escape closes it, and Return
 * activates the `DefaultButton` inside.
 */
export function DialogPopup({
  title,
  controls,
  state,
  onDragRegionPointerDown,
  onDragRegionDoubleClick,
  width,
  container,
  keepMounted = false,
  initialFocus,
  className,
  style,
  children,
  ref,
  ...props
}: DialogPopupProps) {
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
  // The marked element, else the first text field, else the window itself, as in AppKit
  // without full keyboard access. Only what can take the focus is considered.
  const firstFocus = useCallback(() => {
    const dialog = popup.current;
    const candidates = Array.from(
      dialog?.querySelectorAll<HTMLElement>("[data-autofocus],input,textarea") ?? [],
    ).filter(usable);
    return (
      candidates.find((element) => element.hasAttribute("data-autofocus")) ??
      candidates.find((element) => TEXT.test((element as HTMLInputElement).type)) ??
      dialog
    );
  }, []);

  return (
    <BaseDialog.Portal container={container} keepMounted={keepMounted}>
      <BaseDialog.Popup
        render={<Window width={width} state={state} />}
        ref={setPopup}
        initialFocus={initialFocus ?? firstFocus}
        className={withClassName("mac-dialog", className)}
        style={typeof style === "function" ? (state) => place(style(state)) : place(style)}
        {...props}
      >
        <TitleBar
          title={
            title === undefined ? undefined : (
              <BaseDialog.Title render={<span />}>{title}</BaseDialog.Title>
            )
          }
          controls={controls}
          onDragRegionPointerDown={onDragRegionPointerDown}
          onDragRegionDoubleClick={onDragRegionDoubleClick}
        />
        <WindowBody className="mac-dialog-body">{children}</WindowBody>
      </BaseDialog.Popup>
    </BaseDialog.Portal>
  );
}

export interface DialogDescriptionProps extends BaseDialog.Description.Props {}

/**
 * A paragraph that explains the dialog. Assistive technology reads it when the dialog opens.
 */
export function DialogDescription({ className, ...props }: DialogDescriptionProps) {
  return (
    <BaseDialog.Description
      className={withClassName("mac-dialog-description", className)}
      {...props}
    />
  );
}

export interface DialogActionsProps extends ComponentProps<"div"> {
  /**
   * Controls at the leading end of the row: a help button, or buttons that change the content
   * instead of dismissing the dialog.
   */
  leading?: ReactNode;
  /**
   * Draw the 1 pt line above the row that preferences-style dialogs have, from one window edge
   * to the other.
   * @default false
   */
  divider?: boolean;
}

/**
 * The button row at the bottom of a dialog. Its children are the dismissing buttons, set at the
 * trailing end 12 pt apart with the action button last and Cancel before it; each is at least
 * `--mac-dialog-button-min-width` wide.
 */
export function DialogActions({
  leading,
  divider = false,
  className,
  children,
  ...props
}: DialogActionsProps) {
  return (
    <div
      data-divider={divider ? "" : undefined}
      className={cn("mac-dialog-actions", className)}
      {...props}
    >
      {leading === undefined ? null : <div className="mac-dialog-actions-leading">{leading}</div>}
      <div className="mac-dialog-actions-trailing">{children}</div>
    </div>
  );
}

export interface DialogCloseProps extends BaseDialog.Close.Props {}

/**
 * A button that closes the dialog: a push button unless `render` names another control
 * (`render={<DefaultButton />}` for the action button).
 */
export function DialogClose(props: DialogCloseProps) {
  return <BaseDialog.Close render={<PushButton />} {...props} />;
}
