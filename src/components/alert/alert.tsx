"use client";

import { AlertDialog as BaseAlertDialog } from "@base-ui/react/alert-dialog";
import {
  type ComponentProps,
  type CSSProperties,
  createContext,
  type ReactNode,
  use,
  useCallback,
  useRef,
} from "react";
import { cn, withClassName } from "../../lib/cn";
import { windowDragRegion } from "../../lib/window-drag-region";
import { PushButton } from "../push-button";
import { TitleBar, type TitleBarProps } from "../title-bar";
import { Window } from "../window";
import "./alert.tokens.css";
import "./alert.css";

type AlertSize = "regular" | "small";

// The size of the alert a button sits in, so that `AlertClose` matches it.
const AlertSizeContext = createContext<AlertSize>("regular");

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

// A `top` in `style` becomes `--mac-alert-top`, which places the alert and limits its height.
function place(style: CSSProperties | undefined) {
  if (style?.top === undefined) return style;
  const { top, ...rest } = style;
  return {
    ...rest,
    "--mac-alert-top": typeof top === "number" ? `${top}px` : top,
  } as CSSProperties;
}

export interface AlertProps extends BaseAlertDialog.Root.Props {}

/**
 * A Catalina alert (NSAlert): a modal window that warns about an error or a consequence and
 * waits for an answer. Groups the parts: put an `AlertPopup`, and an `AlertTrigger` if a button
 * opens it, inside.
 *
 * Built on Base UI's AlertDialog and takes its Root props: `open`, `defaultOpen`,
 * `onOpenChange`. A click outside never dismisses it.
 */
export function Alert(props: AlertProps) {
  return <BaseAlertDialog.Root {...props} />;
}

export interface AlertTriggerProps extends BaseAlertDialog.Trigger.Props {}

/**
 * The button that opens the alert. Renders a `<button>`; pass the real control with `render`
 * (`render={<PushButton />}`).
 */
export function AlertTrigger(props: AlertTriggerProps) {
  return <BaseAlertDialog.Trigger {...props} />;
}

export interface AlertPopupProps extends BaseAlertDialog.Popup.Props {
  /**
   * The icon: the application's or the subject's, 64 pt (32 pt in a small alert). Decorative;
   * the message carries the meaning.
   */
  icon?: ReactNode;
  /**
   * NSAlert's style. `"critical"` badges the icon with a caution triangle; the two others look
   * the same, as in AppKit.
   * @default "warning"
   */
  alertStyle?: "warning" | "informational" | "critical";
  /**
   * `"regular"` is NSAlert: 420 pt wide, an empty title bar, a bold message. `"small"` is the
   * compact alert Finder uses for a copy conflict: 399 pt wide, no title bar, 11 pt text and
   * small buttons.
   * @default "regular"
   */
  size?: "regular" | "small";
  /**
   * Window controls: a `WindowControls` element. An NSAlert has none; Finder's compact alert
   * has them with close and zoom disabled.
   */
  controls?: ReactNode;
  /**
   * Called when the primary pointer button goes down on the alert's drag region, not on a
   * control: the title bar of a regular alert, the body of a small one, which has no title
   * bar. A window manager starts moving the alert here. A handler on the window that cancels
   * the press first, in the capture phase, keeps it from being reported.
   * @default undefined
   */
  onDragRegionPointerDown?: TitleBarProps["onDragRegionPointerDown"];
  /**
   * Called when the drag region itself is double-clicked.
   * @default undefined
   */
  onDragRegionDoubleClick?: TitleBarProps["onDragRegionDoubleClick"];
  /** Frame width: a number of points, or any CSS length. */
  width?: number | string;
  /** Element the alert is rendered into; the document body by default. */
  container?: BaseAlertDialog.Portal.Props["container"];
  /**
   * Keep the alert in the DOM while it is closed.
   * @default false
   */
  keepMounted?: boolean;
}

/**
 * The alert window: icon at the left, and beside it the children, top to bottom: an
 * `AlertMessage`, an `AlertInformativeText`, an optional `AlertAccessory` and the
 * `AlertButtons`. It is rendered in a portal only while open and keeps the focus inside.
 *
 * When it opens the focus goes to the window itself, as in AppKit without full keyboard access,
 * or to the element marked `data-autofocus`; `initialFocus` overrides that. Tab then reaches
 * the buttons. Escape closes it, and Return activates the `DefaultButton` inside.
 */
export function AlertPopup({
  icon,
  alertStyle = "warning",
  size = "regular",
  controls,
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
}: AlertPopupProps) {
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
  // The marked element when it can take the focus, else the window itself.
  const firstFocus = useCallback(
    () =>
      Array.from(popup.current?.querySelectorAll<HTMLElement>("[data-autofocus]") ?? []).find(
        usable,
      ) ?? popup.current,
    [],
  );
  // A small alert has no title bar: its body is what moves it, when a window manager asks.
  const drag =
    size === "small" && (onDragRegionPointerDown || onDragRegionDoubleClick)
      ? windowDragRegion(onDragRegionPointerDown, onDragRegionDoubleClick)
      : undefined;

  return (
    <BaseAlertDialog.Portal container={container} keepMounted={keepMounted}>
      <BaseAlertDialog.Popup
        render={<Window width={width} />}
        ref={setPopup}
        initialFocus={initialFocus ?? firstFocus}
        data-style={alertStyle}
        data-size={size}
        className={withClassName("mac-alert", className)}
        style={typeof style === "function" ? (state) => place(style(state)) : place(style)}
        {...props}
      >
        {size === "regular" ? (
          <TitleBar
            controls={controls}
            onDragRegionPointerDown={onDragRegionPointerDown}
            onDragRegionDoubleClick={onDragRegionDoubleClick}
          />
        ) : controls ? (
          <div className="mac-alert-controls">{controls}</div>
        ) : null}
        <div className="mac-alert-body" {...drag}>
          <div className="mac-alert-icon" aria-hidden="true">
            {icon}
            {alertStyle === "critical" ? <span className="mac-alert-badge" /> : null}
          </div>
          <div className="mac-alert-content">
            <AlertSizeContext value={size}>{children}</AlertSizeContext>
          </div>
        </div>
      </BaseAlertDialog.Popup>
    </BaseAlertDialog.Portal>
  );
}

export interface AlertMessageProps extends BaseAlertDialog.Title.Props {}

/**
 * The message (NSAlert's `messageText`): a short statement or question, in bold. It names the
 * alert for assistive technology.
 */
export function AlertMessage({ className, ...props }: AlertMessageProps) {
  return (
    <BaseAlertDialog.Title className={withClassName("mac-alert-message", className)} {...props} />
  );
}

export interface AlertInformativeTextProps extends BaseAlertDialog.Description.Props {}

/**
 * The informative text (NSAlert's `informativeText`): the smaller explanation under the
 * message. Assistive technology reads it as the alert's description.
 */
export function AlertInformativeText({ className, ...props }: AlertInformativeTextProps) {
  return (
    <BaseAlertDialog.Description
      className={withClassName("mac-alert-informative-text", className)}
      {...props}
    />
  );
}

export interface AlertAccessoryProps extends ComponentProps<"div"> {}

/**
 * Room under the text for NSAlert's suppression checkbox ("Do not show this message again",
 * a small `Checkbox`) or an accessory view, aligned with the text.
 */
export function AlertAccessory({ className, ...props }: AlertAccessoryProps) {
  return <div className={cn("mac-alert-accessory", className)} {...props} />;
}

export interface AlertButtonsProps extends ComponentProps<"div"> {
  /**
   * Controls at the leading end of the row, aligned with the text: NSAlert's third button, or
   * a help button.
   */
  leading?: ReactNode;
}

/**
 * The button row. Its children are set at the trailing end with the default button last and
 * Cancel before it; each is at least `--mac-alert-button-min-width` wide.
 */
export function AlertButtons({ leading, className, children, ...props }: AlertButtonsProps) {
  return (
    <div className={cn("mac-alert-buttons", className)} {...props}>
      {leading === undefined ? null : <div className="mac-alert-buttons-leading">{leading}</div>}
      <div className="mac-alert-buttons-trailing">{children}</div>
    </div>
  );
}

export interface AlertCloseProps extends BaseAlertDialog.Close.Props {}

/**
 * A button that answers and closes the alert: a push button of the alert's size unless
 * `render` names another control (`render={<DefaultButton />}` for the default button).
 */
export function AlertClose(props: AlertCloseProps) {
  const size = use(AlertSizeContext);
  return <BaseAlertDialog.Close render={<PushButton size={size} />} {...props} />;
}
