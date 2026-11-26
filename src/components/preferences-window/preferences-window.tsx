"use client";

import {
  Children,
  type ComponentProps,
  type CSSProperties,
  Fragment,
  isValidElement,
  type MouseEvent,
  type ReactElement,
  type ReactNode,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from "react";
import { cn, withClassName } from "../../lib/cn";
import { observeResize } from "../../lib/observe-resize";
import { Form, type FormProps, FormRow } from "../form";
import {
  PreferencesToolbarPanel,
  type PreferencesToolbarPanelProps,
  PreferencesToolbarRoot,
  type PreferencesToolbarRootProps,
} from "../preferences-toolbar";
import { TitleBar, type TitleBarProps } from "../title-bar";
import { Window, WindowBody, type WindowState } from "../window";
import { WindowControls } from "../window-controls";
import "./preferences-window.css";

type PaneValue = PreferencesToolbarRootProps["value"];

type ItemProps = { value?: PaneValue; disabled?: boolean; children?: ReactNode };

// The elements among `children`, with those inside fragments in their place.
const elements = (children: ReactNode): ReactElement<ItemProps>[] =>
  Children.toArray(children).flatMap((child) =>
    !isValidElement<ItemProps>(child)
      ? []
      : child.type === Fragment
        ? elements(child.props.children)
        : [child],
  );

// The value of the first enabled item that has one (no `value` given), or the label of the
// item with `value`.
function readToolbar(toolbar: ReactNode, value?: PaneValue): unknown {
  if (!isValidElement<ItemProps>(toolbar)) return undefined;
  for (const { props } of elements(toolbar.props.children)) {
    if (value === undefined ? props.value !== undefined && !props.disabled : props.value === value)
      return value === undefined ? props.value : props.children;
  }
  return undefined;
}

// Whether a menu or listbox is a pop-up that is open, not a list that is part of a pane: it is
// in a portal outside the window, or an expanded button names it, or the element that holds
// it, in `aria-controls`.
const isPopUp = (list: Element, frame: Element) =>
  !frame.contains(list) ||
  Array.from(list.ownerDocument.querySelectorAll('[aria-expanded="true"][aria-controls]')).some(
    (button) =>
      (button.getAttribute("aria-controls") as string)
        .split(" ")
        .some((id) => list.ownerDocument.getElementById(id)?.contains(list)),
  );

export interface PreferencesWindowProps
  extends Omit<PreferencesToolbarRootProps, "title" | "orientation" | "render"> {
  /**
   * The toolbar that switches the panes: a `PreferencesToolbar` element. It is placed in the
   * window's title bar.
   */
  toolbar: ReactNode;
  /**
   * The window title. Read from the `PreferencesToolbarItem` elements given directly to the
   * toolbar, so pass the title yourself when the items are wrapped in components of your own.
   * @default the label of the selected toolbar item
   */
  title?: ReactNode;
  /**
   * The modal kind, as in Music and TV: a `dialog` without window controls, in which Escape
   * calls `onClose`. Its pane ends in a `PreferencesWindowFooter` with Cancel and OK. It takes
   * the keyboard focus when it appears and gives it back when it is removed. It does not make
   * the rest of the page inert or contain focus, so it does not set `aria-modal`: present it
   * in a dialog or sheet that does.
   * @default false
   */
  modal?: boolean;
  /**
   * The window controls. Pass `null` for none. Controls given here are shown in the modal
   * kind too, which has none in Catalina.
   * @default the usual three with minimize and zoom disabled; none in the modal kind
   */
  controls?: ReactNode;
  /** Called when the close button is activated and, in a modal window, when Escape is pressed. */
  onClose?: (event: MouseEvent<HTMLElement> | KeyboardEvent) => void;
  /** Called when the primary pointer button goes down on the title bar itself, not on a control or toolbar item in it: a window manager starts moving the window here. */
  onDragRegionPointerDown?: TitleBarProps["onDragRegionPointerDown"];
  /** Called when the title bar itself is double-clicked. */
  onDragRegionDoubleClick?: TitleBarProps["onDragRegionDoubleClick"];
  /**
   * Whether the window is key, main or inactive (see `Window`).
   * @default "key"
   */
  state?: WindowState;
  /**
   * Frame width: a number of points or any CSS length. A preferences window is not resizable;
   * without a width it is as wide as its widest bar or pane.
   */
  width?: number | string;
  /** Frame height. Without it the window is as tall as the selected pane, as in Catalina. */
  height?: number | string;
  /**
   * Animate the frame from the size of the pane that was shown to the size of the new one.
   * Never animated for a visitor who prefers reduced motion.
   * @default true
   */
  animated?: boolean;
}

/**
 * A preferences window: a `Window` whose title bar holds a `PreferencesToolbar` and whose body
 * shows the selected item's pane (`PreferencesWindowPane` children). The title follows the
 * selection. It is Base UI's Tabs.Root: `value`, `defaultValue`, `onValueChange`.
 */
export function PreferencesWindow({
  toolbar,
  title,
  modal = false,
  controls,
  onClose,
  onDragRegionPointerDown,
  onDragRegionDoubleClick,
  state = "key",
  width,
  height,
  animated = true,
  value,
  defaultValue,
  onValueChange,
  onKeyDown,
  className,
  children,
  ...props
}: PreferencesWindowProps) {
  const [initial] = useState<PaneValue>(() =>
    defaultValue === undefined ? (readToolbar(toolbar) as PaneValue) : defaultValue,
  );
  // Base UI holds the selection; this copy only feeds the title and the resize below.
  const [own, setOwn] = useState<PaneValue>(initial);
  const current = value === undefined ? own : value;

  // The frame keeps its top-left corner and grows or shrinks to the new pane. CSS cannot
  // transition to an automatic size, so the frame is read twice per change of pane: as it is
  // displayed when the change is asked for (mid-animation included), and with the new pane.
  const body = useRef<HTMLDivElement>(null);
  const size = useRef<[number, number] | null>(null);
  const measure = () => {
    const root = body.current?.parentElement;
    if (root) size.current = [root.offsetWidth, root.offsetHeight];
    return root;
  };
  // Between changes of pane the size follows the frame as it is displayed: content that grows
  // or shrinks, and each step of a running animation. So a change that comes from outside
  // (a controlled `value`), which nothing announces, also starts where the frame is.
  useLayoutEffect(() => {
    const root = body.current?.parentElement;
    if (!root) return;
    return observeResize(root, () => {
      size.current = [root.offsetWidth, root.offsetHeight];
    });
  }, []);
  // biome-ignore lint/correctness/useExhaustiveDependencies: runs when the pane changes.
  useLayoutEffect(() => {
    const from = size.current;
    const root = measure();
    const to = size.current;
    if (!root || !to || !animated || !from || (from[0] === to[0] && from[1] === to[1])) return;
    if (typeof root.animate !== "function") return;
    const view = root.ownerDocument.defaultView;
    if (view?.matchMedia?.("(prefers-reduced-motion: reduce)").matches) return;
    const animation = root.animate(
      [
        { width: `${from[0]}px`, height: `${from[1]}px` },
        { width: `${to[0]}px`, height: `${to[1]}px` },
      ],
      { duration: 200, easing: "ease-in-out" },
    );
    return () => animation.cancel();
  }, [current, animated]);

  // The modal kind takes the focus when it appears, so that Escape reaches it at once, and
  // gives it back to where it was when it is removed, unless the focus has moved on by itself.
  // What had the focus before is read in the first render: a control with `autoFocus`, in a
  // pane or in a portal, has it before any effect runs, and keeps it.
  const [opener] = useState(() =>
    typeof document === "undefined" ? null : (document.activeElement as HTMLElement | null),
  );
  useEffect(() => {
    const root = body.current?.parentElement;
    if (!modal || !root) return;
    const page = root.ownerDocument;
    if (page.activeElement === opener) root.focus({ preventScroll: true });
    return () => {
      const now = page.activeElement;
      if (opener?.isConnected && (!now || now === page.body)) {
        opener.focus({ preventScroll: true });
      }
    };
  }, [modal, opener]);

  const shownControls =
    controls !== undefined ? (
      controls
    ) : modal ? null : (
      <WindowControls minimizeDisabled zoomDisabled onClose={onClose} />
    );

  return (
    <PreferencesToolbarRoot
      value={value}
      defaultValue={initial}
      onValueChange={(next, details) => {
        measure();
        onValueChange?.(next, details);
        if (!details.isCanceled) setOwn(next);
      }}
      onKeyDown={(event) => {
        onKeyDown?.(event);
        const origin = event.target as Element;
        const list = origin.closest('[role="menu"],[role="listbox"]');
        if (
          modal &&
          event.key === "Escape" &&
          !event.defaultPrevented &&
          // A menu or pop-up that is open is what Escape closes first: the key comes from its
          // button or from its list. Any other control answers, in a portal too (React hands
          // a portal's events to the window), and so does a list that is part of a pane.
          !origin.closest('[aria-expanded="true"][aria-haspopup]') &&
          !(list && isPopUp(list, event.currentTarget))
        ) {
          onClose?.(event.nativeEvent);
        }
      }}
      data-modal={modal ? "" : undefined}
      className={withClassName("mac-preferences-window", className)}
      render={
        modal ? (
          <Window state={state} width={width} height={height} role="dialog" tabIndex={-1} />
        ) : (
          <Window state={state} width={width} height={height} />
        )
      }
      {...props}
    >
      <TitleBar
        variant="unified"
        title={title !== undefined ? title : (readToolbar(toolbar, current ?? null) as ReactNode)}
        controls={shownControls}
        onDragRegionPointerDown={onDragRegionPointerDown}
        onDragRegionDoubleClick={onDragRegionDoubleClick}
      >
        {toolbar}
      </TitleBar>
      <WindowBody ref={body} className="mac-preferences-window-body">
        {children}
      </WindowBody>
    </PreferencesToolbarRoot>
  );
}

export interface PreferencesWindowPaneProps extends PreferencesToolbarPanelProps {}

/*
 * Base UI's Tabs.Panel with a pane's 20 pt margins. Not in the DOM while hidden, unless
 * `keepMounted`. (The descriptions below are one line each because the build keeps them and
 * the size budget counts them.)
 */
/** One pane, shown while the toolbar item with the same `value` is selected. */
export function PreferencesWindowPane({ className, ...props }: PreferencesWindowPaneProps) {
  return (
    <PreferencesToolbarPanel
      className={withClassName("mac-preferences-window-pane", className)}
      {...props}
    />
  );
}

export interface PreferencesWindowFormProps extends ComponentProps<"div"> {}

/*
 * The library's Form as a <div>, with the two columns as wide as their content and centred as
 * a block. Children are `PreferencesWindowRow` elements; anything else (a `Separator`) spans
 * both columns.
 */
/* A preferences pane's own hooks, handed to the Form's: rows 10 pt apart by default. */
const formHooks = {
  "--mac-form-row-gap": "var(--mac-preferences-window-row-gap, 10px)",
  "--mac-form-label-gap": "var(--mac-preferences-window-label-gap, var(--mac-space-label-gap))",
} as CSSProperties;

/** A pane's form: labels and controls in two columns. */
export function PreferencesWindowForm({ className, style, ...props }: PreferencesWindowFormProps) {
  return (
    <Form
      render={<div />}
      className={cn("mac-preferences-window-form", className)}
      style={{ ...formHooks, ...style }}
      // The props are a <div>'s; Form types them for the <form> it renders by default.
      {...(props as FormProps)}
    />
  );
}

export interface PreferencesWindowRowProps extends ComponentProps<"div"> {
  /**
   * The row's label, in the label column: text ending in a colon. Without it the row's
   * controls still sit in the control column.
   */
  label?: ReactNode;
  /**
   * The `id` of the one control the label is for; the label is then a `<label>` for it.
   * Without it the row's controls are a group named by the label.
   */
  labelFor?: string;
  /**
   * How the label and the controls line up: on their first baselines, or by their centres or
   * top edges, for controls without text.
   * @default "baseline"
   */
  align?: "baseline" | "center" | "start";
}

/*
 * A FormRow: with `labelFor` the label is a native <label> for that control; without it the
 * row is a group named by its label, or a plain row when it has no label.
 */
/** One row of a `PreferencesWindowForm`: a label and the control or controls it names. */
export function PreferencesWindowRow({
  label,
  labelFor,
  align = "baseline",
  className,
  ...props
}: PreferencesWindowRowProps) {
  return (
    <FormRow
      kind="group"
      label={label}
      labelFor={labelFor}
      align={align}
      className={cn("mac-preferences-window-row", className)}
      {...props}
    />
  );
}

export interface PreferencesWindowFooterProps extends ComponentProps<"div"> {
  /** What sits at the leading edge, apart from the buttons: usually a `HelpButton`. */
  leading?: ReactNode;
}

/*
 * The buttons are 12 pt apart (Cancel and OK in the modal kind, or a help button alone).
 */
/** A pane's bottom row: buttons at the trailing edge, `leading` content at the leading edge. */
export function PreferencesWindowFooter({
  leading,
  className,
  children,
  ...props
}: PreferencesWindowFooterProps) {
  return (
    <div className={cn("mac-preferences-window-footer", className)} {...props}>
      {leading === undefined || leading === null || leading === false ? null : (
        <div className="mac-preferences-window-footer-leading">{leading}</div>
      )}
      {children}
    </div>
  );
}
