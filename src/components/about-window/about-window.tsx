"use client";

import { Tabs as BaseTabs } from "@base-ui/react/tabs";
import {
  Children,
  type ComponentProps,
  isValidElement,
  type KeyboardEvent,
  type MouseEvent,
  type ReactNode,
  type Ref,
  useState,
} from "react";
import { cn, withClassName } from "../../lib/cn";
import { TitleBar, type TitleBarProps } from "../title-bar";
import { Window, WindowBody, type WindowState } from "../window";
import { WindowControls } from "../window-controls";
import "./about-window.tokens.css";
import "./about-window.css";

type TabValue = BaseTabs.Root.Props["value"];

const given = (node: ReactNode) => node !== undefined && node !== null && node !== false;

// The value of the first tab that is not disabled, read from the `tabs` element. A tab is an
// element with a `value`; anything else (the tab control, a fragment) is looked into. A
// component that renders its tabs itself cannot be read: such a window takes `defaultValue`.
function firstTab(node: ReactNode): TabValue {
  for (const child of Children.toArray(node)) {
    if (!isValidElement<{ children?: ReactNode; value?: TabValue; disabled?: boolean }>(child)) {
      continue;
    }
    const { value, disabled, children } = child.props;
    if (value === undefined) {
      const found = firstTab(children);
      if (found !== undefined) return found;
    } else if (!disabled) {
      return value;
    }
  }
  return undefined;
}

// Control-Tab and Control-Shift-Tab select the next and the previous tab, wrapping round,
// while the focus is in the tab control. A browser keeps these keys for its own tabs, so the
// page only receives them where there are none: an installed web app, an embedded web view.
function cycleTabs(event: KeyboardEvent<HTMLDivElement>, activateOnFocus: boolean) {
  if (event.defaultPrevented || event.key !== "Tab" || !event.ctrlKey) return;
  if (event.altKey || event.metaKey) return;
  const tabs = Array.from(
    event.currentTarget.querySelectorAll<HTMLElement>('[role="tab"]:not([data-disabled])'),
  );
  const selected = tabs.findIndex((tab) => tab.getAttribute("aria-selected") === "true");
  const step = event.shiftKey ? -1 : 1;
  // From no selected tab, forwards goes to the first tab and backwards to the last.
  const next =
    tabs[((selected === -1 && step === -1 ? 0 : selected) + step + tabs.length) % tabs.length];
  if (!next) return;
  event.preventDefault();
  // Focusing a tab selects it when the control activates on focus; otherwise the click does.
  next.focus();
  if (!activateOnFocus) next.click();
}

export interface AboutWindowProps
  extends Omit<BaseTabs.Root.Props, "title" | "orientation" | "render" | "ref"> {
  /**
   * The tab control: an `AboutWindowTabs` element. It is placed in the title bar, centred on
   * the window, and the bar is then 38 pt high and shows no title. Without it the window has
   * the plain 22 pt title bar.
   */
  tabs?: ReactNode;
  /**
   * The window's title. With `tabs` the bar has no room for it and it only names the window
   * for assistive technology; without them it is shown, centred in the title bar.
   */
  title?: string;
  /**
   * The window controls. Pass `null` for none.
   * @default the usual three with zoom disabled
   */
  controls?: ReactNode;
  /** Called when the close button is activated. */
  onClose?: (event: MouseEvent<HTMLElement>) => void;
  /**
   * Called when the primary pointer button goes down on the title bar itself, not on a window
   * control or a tab in it. A window manager starts moving the window here.
   */
  onDragRegionPointerDown?: TitleBarProps["onDragRegionPointerDown"];
  /** Called when the title bar itself is double-clicked. */
  onDragRegionDoubleClick?: TitleBarProps["onDragRegionDoubleClick"];
  /**
   * Whether the window is key, main or inactive (see `Window`).
   * @default "key"
   */
  state?: WindowState;
  /**
   * Frame width: a number of points or any CSS length. An About window is not resizable.
   * @default 586
   */
  width?: number | string;
  /** Frame height. Without it the window is as tall as its content. */
  height?: number | string;
  /** Ref to the window element. */
  ref?: Ref<HTMLDivElement>;
}

/**
 * An About window, as About This Mac: a `Window` whose title bar holds a centred tab control
 * and whose body shows the pane of the selected tab (`AboutWindowPanel` children).
 *
 * It is Base UI's Tabs.Root (`value`, `defaultValue`, `onValueChange`); the first tab that is
 * not disabled is selected by default. Like `Window` it is presentational.
 */
export function AboutWindow({
  tabs,
  title,
  controls,
  onClose,
  onDragRegionPointerDown,
  onDragRegionDoubleClick,
  state = "key",
  width = 586,
  height,
  defaultValue,
  className,
  children,
  ...props
}: AboutWindowProps) {
  const hasTabs = given(tabs);
  // Read once: Base UI would select the first tab too, but only after the first render, and
  // a server-rendered window would then arrive without its pane.
  const [initial] = useState(() => (defaultValue === undefined ? firstTab(tabs) : defaultValue));

  return (
    <BaseTabs.Root
      defaultValue={initial}
      className={withClassName("mac-about-window", className)}
      render={
        <Window
          state={state}
          width={width}
          height={height}
          aria-label={hasTabs ? title : undefined}
        />
      }
      {...props}
    >
      <TitleBar
        variant={hasTabs ? "title-hidden" : "standard"}
        title={hasTabs ? undefined : title}
        onDragRegionPointerDown={onDragRegionPointerDown}
        onDragRegionDoubleClick={onDragRegionDoubleClick}
        controls={
          controls === undefined ? (
            <WindowControls zoomRole="zoom" zoomDisabled onClose={onClose} />
          ) : (
            controls
          )
        }
      >
        {hasTabs ? <div className="mac-about-window-bar">{tabs}</div> : null}
      </TitleBar>
      <WindowBody className="mac-about-window-body">{children}</WindowBody>
    </BaseTabs.Root>
  );
}

export interface AboutWindowTabsProps extends Omit<BaseTabs.List.Props, "ref"> {
  /**
   * Whether moving the focus to a tab with the arrow keys also selects it, as in AppKit. When
   * false, the arrow keys only move the focus and Space or Return selects.
   * @default true
   */
  activateOnFocus?: boolean;
  /** Ref to the rendered element. */
  ref?: Ref<HTMLDivElement>;
}

/**
 * The tab control of the title bar, a `tablist` (Base UI's Tabs.List): the arrow keys move
 * between the tabs, and Control-Tab and Control-Shift-Tab cycle through them.
 */
export function AboutWindowTabs({
  activateOnFocus = true,
  className,
  onKeyDown,
  ...props
}: AboutWindowTabsProps) {
  return (
    <BaseTabs.List
      activateOnFocus={activateOnFocus}
      className={withClassName("mac-about-window-tabs", className)}
      onKeyDown={(event) => {
        onKeyDown?.(event);
        cycleTabs(event, activateOnFocus);
      }}
      {...props}
    />
  );
}

export interface AboutWindowTabProps extends Omit<BaseTabs.Tab.Props, "ref"> {
  /** Ref to the rendered element. */
  ref?: Ref<HTMLElement>;
}

/** One tab, a `<button>` (Base UI's Tabs.Tab). `value` links it to the panel with that value. */
export function AboutWindowTab({ className, ...props }: AboutWindowTabProps) {
  return <BaseTabs.Tab className={withClassName("mac-about-window-tab", className)} {...props} />;
}

export interface AboutWindowPanelProps extends Omit<BaseTabs.Panel.Props, "ref"> {
  /** Ref to the rendered element. */
  ref?: Ref<HTMLDivElement>;
}

/** The pane shown while the tab with the same `value` is selected (Base UI's Tabs.Panel). */
export function AboutWindowPanel({ className, ...props }: AboutWindowPanelProps) {
  return (
    <BaseTabs.Panel className={withClassName("mac-about-window-panel", className)} {...props} />
  );
}

export interface AboutWindowOverviewProps extends ComponentProps<"div"> {
  /**
   * The picture at the left: the badge of the operating system, or an application icon. It is
   * centred in a 153 pt square; the library ships no artwork, so supply your own (an
   * `ImageView`, an inline SVG).
   */
  image?: ReactNode;
}

/**
 * The Overview layout: a picture at the left and, as children, the column of text at the
 * right: title, version, details and actions.
 */
export function AboutWindowOverview({
  image,
  className,
  children,
  ...props
}: AboutWindowOverviewProps) {
  return (
    <div className={cn("mac-about-window-overview", className)} {...props}>
      <div className="mac-about-window-image">{image}</div>
      <div className="mac-about-window-content">{children}</div>
    </div>
  );
}

export interface AboutWindowTitleProps extends ComponentProps<"h1"> {
  /**
   * The words set in bold before the rest of the title: the product's name before the name
   * of the release ("macOS" before "Catalina").
   */
  emphasized?: ReactNode;
}

/** The product title, the window's `<h1>`: 26 pt, light, with an optional bold beginning. */
export function AboutWindowTitle({
  emphasized,
  className,
  children,
  ...props
}: AboutWindowTitleProps) {
  return (
    <h1 className={cn("mac-about-window-title", className)} {...props}>
      {given(emphasized) ? (
        <>
          <span className="mac-about-window-title-emphasized">{emphasized}</span>{" "}
        </>
      ) : null}
      {children}
    </h1>
  );
}

export interface AboutWindowVersionProps extends ComponentProps<"p"> {
  /** The word set in bold before the version: "Version". */
  label?: ReactNode;
}

/** The version line under the title: small text, with an optional bold label before it. */
export function AboutWindowVersion({
  label,
  className,
  children,
  ...props
}: AboutWindowVersionProps) {
  return (
    <p className={cn("mac-about-window-version", className)} {...props}>
      {given(label) ? (
        <>
          <span className="mac-about-window-version-label">{label}</span>{" "}
        </>
      ) : null}
      {children}
    </p>
  );
}

export interface AboutWindowDetailsProps extends ComponentProps<"ul"> {}

/** The list of details (model, processor, memory): a `<ul>` of `AboutWindowDetail` rows. */
export function AboutWindowDetails({ className, ...props }: AboutWindowDetailsProps) {
  return <ul className={cn("mac-about-window-details", className)} {...props} />;
}

export interface AboutWindowDetailProps extends ComponentProps<"li"> {
  /**
   * The row's name, in bold: "Processor". A row with a label and no children is a bold line
   * of its own, as the model name is.
   */
  label?: ReactNode;
}

/** One row of `AboutWindowDetails`: a bold label and, as children, its value. */
export function AboutWindowDetail({
  label,
  className,
  children,
  ...props
}: AboutWindowDetailProps) {
  return (
    <li className={cn("mac-about-window-detail", className)} {...props}>
      {given(label) ? <span className="mac-about-window-detail-label">{label}</span> : null}
      {/* The space is for whoever reads the row as text; the row's gap sets the distance. */}
      {given(label) && given(children) ? " " : null}
      {given(children) ? <span className="mac-about-window-detail-value">{children}</span> : null}
    </li>
  );
}

export interface AboutWindowActionsProps extends ComponentProps<"div"> {}

/** The row of small push buttons under the details. */
export function AboutWindowActions({ className, ...props }: AboutWindowActionsProps) {
  return <div className={cn("mac-about-window-actions", className)} {...props} />;
}

export interface AboutWindowFooterProps extends ComponentProps<"p"> {}

/** The legal text at the bottom of a pane, after the `AboutWindowOverview`: 10 pt, grey. */
export function AboutWindowFooter({ className, ...props }: AboutWindowFooterProps) {
  return <p className={cn("mac-about-window-footer", className)} {...props} />;
}

export interface AboutWindowLinkProps extends ComponentProps<"a"> {}

/** A link in the colour of the text around it, underlined under the pointer: an `<a>`. */
export function AboutWindowLink({ className, ...props }: AboutWindowLinkProps) {
  return <a className={cn("mac-about-window-link", className)} {...props} />;
}
