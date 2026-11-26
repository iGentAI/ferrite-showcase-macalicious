"use client";

import { Tabs as BaseTabs } from "@base-ui/react/tabs";
import {
  createContext,
  type MouseEvent,
  type Ref,
  type SyntheticEvent,
  use,
  useCallback,
  useEffect,
  useId,
  useLayoutEffect,
  useRef,
  useState,
} from "react";
import { createPortal } from "react-dom";
import { attachRef } from "../../lib/attach-ref";
import { withClassName } from "../../lib/cn";
import "./window-tab-bar.tokens.css";
import "./window-tab-bar.css";

/** The bar's layer for close buttons, which the tabs render theirs into. */
const ClosersContext = createContext<HTMLElement | null>(null);

/** Puts a close button's slot at `left`, `width` wide. */
function put(slot: HTMLElement, left: number, width: number) {
  // Written only when it changes: this also runs once a frame while the pointer is in the bar.
  if (slot.style.left !== `${left}px`) slot.style.left = `${left}px`;
  if (slot.style.width !== `${width}px`) slot.style.width = `${width}px`;
}

/** Lays a close button's slot over its tab. The slot is outside the tab list, so CSS cannot. */
function place(tab: HTMLElement | null, slot: HTMLElement | null) {
  if (tab && slot) put(slot, tab.offsetLeft, tab.offsetWidth);
}

export interface WindowTabBarProps extends Omit<BaseTabs.Root.Props, "ref" | "orientation"> {
  /**
   * Called when the new-tab button is clicked. The button, a 24 pt cell with a + at the
   * trailing end of the bar, is only rendered when this is set. It is a `<button>` of its own,
   * outside the tab list.
   */
  onNewTab?: (event: MouseEvent<HTMLButtonElement>) => void;
  /**
   * Accessible name of the new-tab button.
   * @default "New Tab"
   */
  newTabLabel?: string;
  /**
   * Whether moving focus to a tab with the arrow keys also selects it. By default the arrow
   * keys only move focus and Space or Return selects, so that passing over a tab does not
   * swap the whole window's content.
   * @default false
   */
  activateOnFocus?: boolean;
  /** Ref to the rendered element, the bar. */
  ref?: Ref<HTMLDivElement>;
}

/**
 * The tab bar of a window (NSWindow tabbing): equal-width tabs under the toolbar, one of them
 * selected, and optionally a new-tab button.
 *
 * Built on Base UI's Tabs: it is the Tabs root and the tab list in one element, so it accepts
 * `value`, `defaultValue` and `onValueChange` and supplies the tab semantics and the arrow
 * keys. Its children are `WindowTab`s. `aria-label` and `aria-labelledby` name the tab list.
 */
export function WindowTabBar({
  onNewTab,
  newTabLabel = "New Tab",
  activateOnFocus = false,
  "aria-label": ariaLabel,
  "aria-labelledby": ariaLabelledBy,
  onPointerEnter,
  onPointerMove,
  onPointerLeave,
  className,
  children,
  ...props
}: WindowTabBarProps) {
  const [closers, setClosers] = useState<HTMLElement | null>(null);
  const list = useRef<HTMLDivElement>(null);
  const placeSlots = useRef<() => void>(undefined);
  const frame = useRef(0);

  // A tab moves when it is rendered, which it sees itself, and when anything before it in the
  // list comes, goes, changes places or changes size: none of that renders the tab, and a
  // neighbour made wider by a style need not change the tab's own size. So the bar watches
  // the list's children and the size of each, tabs without a close button included, and lays
  // every slot over its tab again. Both observers report before the browser paints.
  //
  // A style can still move tabs without changing the size of anything (a wider gap between
  // tabs of fixed widths), which nothing reports. A close button shows, and takes a press,
  // only under the pointer, so while the pointer is in the bar the slots are laid out again
  // before every frame: a button under the pointer is over its tab.
  useEffect(() => {
    const tabs = list.current;
    if (!tabs || !closers) return;
    const placeAll = () => {
      const byId = new Map<string, HTMLElement>();
      for (const tab of tabs.children) byId.set(tab.id, tab as HTMLElement);
      // Every tab is measured before any slot is moved, so the browser lays out once.
      const places: [slot: HTMLElement, left: number, width: number][] = [];
      for (const slot of closers.children) {
        // The close button's id is its tab's id and "-close".
        const tab = byId.get(slot.firstElementChild?.id.slice(0, -6) ?? "");
        if (tab) places.push([slot as HTMLElement, tab.offsetLeft, tab.offsetWidth]);
      }
      for (const [slot, left, width] of places) put(slot, left, width);
    };
    // Sizes are not reported where there is no ResizeObserver; the rest still works.
    const sizes = typeof ResizeObserver === "undefined" ? undefined : new ResizeObserver(placeAll);
    const watch = () => {
      sizes?.disconnect();
      sizes?.observe(tabs);
      for (const tab of tabs.children) sizes?.observe(tab);
      placeAll();
    };
    const children = new MutationObserver(watch);
    children.observe(tabs, { childList: true });
    children.observe(closers, { childList: true });
    watch();
    placeSlots.current = placeAll;
    return () => {
      placeSlots.current = undefined;
      cancelAnimationFrame(frame.current);
      frame.current = 0;
      sizes?.disconnect();
      children.disconnect();
    };
  }, [closers]);

  /** Lays the slots out now and before every frame, from the pointer's entry to its leaving. */
  const follow = () => {
    if (!placeSlots.current) return;
    placeSlots.current();
    frame.current = requestAnimationFrame(follow);
  };

  return (
    <BaseTabs.Root
      className={withClassName("mac-window-tab-bar", className)}
      onPointerEnter={(event) => {
        cancelAnimationFrame(frame.current);
        follow();
        onPointerEnter?.(event);
      }}
      // A pointer that was already in the bar when it appeared never entered it.
      onPointerMove={(event) => {
        if (!frame.current) follow();
        onPointerMove?.(event);
      }}
      onPointerLeave={(event) => {
        cancelAnimationFrame(frame.current);
        frame.current = 0;
        onPointerLeave?.(event);
      }}
      {...props}
    >
      <BaseTabs.List
        ref={list}
        activateOnFocus={activateOnFocus}
        aria-label={ariaLabel}
        aria-labelledby={ariaLabelledBy}
        className="mac-window-tab-bar-list"
      >
        <ClosersContext value={closers}>{children}</ClosersContext>
      </BaseTabs.List>
      <div ref={setClosers} className="mac-window-tab-bar-closers" />
      {onNewTab ? (
        <button
          type="button"
          className="mac-window-tab-bar-new"
          aria-label={newTabLabel}
          onClick={onNewTab}
        />
      ) : null}
    </BaseTabs.Root>
  );
}

export interface WindowTabProps extends Omit<BaseTabs.Tab.Props, "ref"> {
  /**
   * Called when the tab is closed: by its close button, which appears at the tab's leading
   * edge under the pointer, or by Delete or Backspace while the tab has keyboard focus. Remove
   * the tab in response. Without it the tab cannot be closed; a disabled tab has no close
   * button.
   */
  onClose?: (event: SyntheticEvent<HTMLElement>) => void;
  /**
   * Accessible name of the close button. The tab's title follows it: "Close Home".
   * @default "Close"
   */
  closeLabel?: string;
  /** Ref to the rendered element. */
  ref?: Ref<HTMLElement>;
}

/**
 * One tab of a `WindowTabBar`: a centred title that is cut at the end when it does not fit.
 * Renders Base UI's Tabs.Tab, a `<button role="tab">`, and takes its `value` and `disabled`.
 * With `onClose` it also renders a close button, a `<button>` beside the tab list.
 */
export function WindowTab({
  onClose,
  closeLabel = "Close",
  id,
  disabled,
  onKeyDown,
  onPointerEnter,
  onPointerLeave,
  className,
  children,
  ref,
  ...props
}: WindowTabProps) {
  const closers = use(ClosersContext);
  const ownId = useId();
  const tabId = id ?? ownId;
  const tab = useRef<HTMLElement | null>(null);
  const slot = useRef<HTMLSpanElement>(null);
  const [hover, setHover] = useState(false);
  const closable = Boolean(onClose && !disabled && closers);

  const setTab = useCallback(
    (element: HTMLElement | null) => {
      tab.current = element;
      const release = attachRef(ref, element);
      return () => {
        tab.current = null;
        release();
      };
    },
    [ref],
  );

  // After every render of the tab, before the browser paints; the bar does the rest.
  useLayoutEffect(() => place(tab.current, slot.current));

  // A button cannot sit inside the tab, which is a button, and a tab list holds only tabs: the
  // close button goes into the bar's layer beside the list, in a slot kept over this tab. The
  // pointer being over either of the two counts as being over the tab.
  const close =
    closable && closers && onClose
      ? createPortal(
          <span
            ref={slot}
            className="mac-window-tab-bar-close-slot"
            data-hover={hover ? "" : undefined}
            data-force={(props as { "data-force"?: string })["data-force"]}
          >
            <button
              type="button"
              // Out of the tab order: the bar is one tab stop, and Delete closes from there.
              tabIndex={-1}
              id={`${tabId}-close`}
              aria-label={closeLabel}
              aria-labelledby={`${tabId}-close ${tabId}`}
              className="mac-window-tab-bar-close"
              onMouseDown={(event) => event.preventDefault()}
              onPointerEnter={() => setHover(true)}
              onPointerLeave={() => setHover(false)}
              onClick={(event) => {
                // A click from a pointer counts only where the button is over its tab. Laid
                // out again first, a button that had been left behind where its tab was is no
                // longer under the click, and closes nothing.
                place(tab.current, slot.current);
                const box = event.currentTarget.getBoundingClientRect();
                if (!event.detail || (event.clientX >= box.left && event.clientX <= box.right)) {
                  onClose(event);
                }
              }}
            />
          </span>,
          closers,
        )
      : null;

  return (
    <>
      <BaseTabs.Tab
        ref={setTab}
        id={tabId}
        disabled={disabled}
        aria-keyshortcuts={onClose ? "Delete" : undefined}
        data-hover={closable && hover ? "" : undefined}
        className={withClassName("mac-window-tab-bar-tab", className)}
        onKeyDown={(event) => {
          onKeyDown?.(event);
          if (onClose && !event.defaultPrevented && /^(Delete|Backspace)$/.test(event.key)) {
            onClose(event);
          }
        }}
        onPointerEnter={(event) => {
          onPointerEnter?.(event);
          setHover(true);
        }}
        onPointerLeave={(event) => {
          onPointerLeave?.(event);
          setHover(false);
        }}
        {...props}
      >
        <span className="mac-window-tab-bar-title">{children}</span>
      </BaseTabs.Tab>
      {close}
    </>
  );
}
