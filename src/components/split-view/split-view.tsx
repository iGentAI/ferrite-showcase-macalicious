"use client";

import {
  type ComponentProps,
  type CSSProperties,
  createContext,
  type KeyboardEvent,
  type PointerEvent,
  useContext,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
} from "react";
import { flushSync } from "react-dom";
import { observeResize } from "../../lib/observe-resize";
import "./split-view.tokens.css";
import "./split-view.css";

type Orientation = "horizontal" | "vertical";
// The panes of one split view: a pane's key to the function that gives it a new size.
type Panes = Map<string, (size: number) => void>;
const SplitViewContext = createContext<{ panes: Panes; orientation: Orientation } | null>(null);

export interface SplitViewProps extends ComponentProps<"div"> {
  /**
   * `"horizontal"` puts the panes side by side (NSSplitView.isVertical = true),
   * `"vertical"` stacks them.
   * @default "horizontal"
   */
  orientation?: Orientation;
  /**
   * Divider style: a 1 pt line, a clear 9 pt band or a 10 pt band with a dimple
   * (NSSplitView.DividerStyle).
   * @default "thin"
   */
  dividerStyle?: "thin" | "thick" | "pane-splitter";
}

/**
 * A split view (NSSplitView): panes laid edge to edge with a divider between each pair. Its
 * children are `SplitViewPane`s and `SplitViewDivider`s, alternating.
 */
export function SplitView({
  orientation = "horizontal",
  dividerStyle = "thin",
  className,
  ...props
}: SplitViewProps) {
  const [panes] = useState<Panes>(() => new Map());
  const context = useMemo(() => ({ panes, orientation }), [panes, orientation]);
  return (
    <SplitViewContext.Provider value={context}>
      <div
        data-orientation={orientation}
        data-divider-style={dividerStyle}
        className={className ? `mac-split-view ${className}` : "mac-split-view"}
        {...props}
      />
    </SplitViewContext.Provider>
  );
}

export interface SplitViewPaneProps extends ComponentProps<"div"> {
  /** Size along the split axis in points, controlled. Without a size the pane is flexible. */
  size?: number;
  /** Initial size in points of a pane that keeps its own size. */
  defaultSize?: number;
  /** Called with the new size while a divider resizes the pane; 0 means collapsed. */
  onSizeChange?: (size: number) => void;
  /**
   * Smallest size of the pane: a divider does not make it smaller, and a flexible pane does
   * not give up more than this to a pane that grows.
   * @default 0
   */
  minSize?: number;
  /**
   * Largest size a divider can give the pane. A pane never grows by more than the flexible
   * panes can give up, whatever its maximum.
   */
  maxSize?: number;
  /**
   * Whether the pane collapses to nothing: when dragged to under half its minimum size, on a
   * double click of its divider, or with Return on the divider.
   * @default false
   */
  collapsible?: boolean;
}

/** One pane of a split view. A pane with a size keeps it; panes without one share the rest. */
export function SplitViewPane({
  size,
  defaultSize,
  onSizeChange,
  minSize = 0,
  maxSize,
  collapsible = false,
  className,
  style,
  ...props
}: SplitViewPaneProps) {
  const panes = useContext(SplitViewContext)?.panes;
  const key = useId();
  const [own, setOwn] = useState(defaultSize);
  const current = size ?? own;
  // Dividers find the pane beside them in the DOM and reach its size through this key.
  useEffect(() => {
    panes?.set(key, (next) => {
      setOwn(next);
      onSizeChange?.(next);
    });
    return () => void panes?.delete(key);
  }, [panes, key, onSizeChange]);
  return (
    <div
      // What the divider that resizes the pane names in aria-controls; the caller's id wins.
      id={key}
      data-pane={key}
      data-sized={current === undefined ? undefined : ""}
      data-collapsed={current === 0 ? "" : undefined}
      data-min-size={minSize}
      data-max-size={maxSize}
      data-collapsible={collapsible ? "" : undefined}
      className={className ? `mac-split-view-pane ${className}` : "mac-split-view-pane"}
      style={
        {
          "--_size": current === undefined ? undefined : `${current}px`,
          // The limits hold for a flexible pane too, and are always set: a split view inside
          // this pane must not inherit them.
          "--_min": `${minSize}px`,
          "--_max": maxSize === undefined ? "none" : `${maxSize}px`,
          ...style,
          // A collapsed pane takes no space, whatever padding or display its style sets.
          ...(current === 0 && { display: "none" }),
        } as CSSProperties
      }
      {...props}
    />
  );
}

export interface SplitViewDividerProps extends ComponentProps<"div"> {
  /**
   * A fixed divider: drawn, but it cannot be dragged or focused.
   * @default false
   */
  disabled?: boolean;
}

// Points an arrow key moves a divider.
const STEP = 10;

// The pane a divider resizes, its size and limits, and which way a drag grows it.
function measure(element: HTMLElement | null, horizontal: boolean) {
  const before = element?.previousElementSibling;
  const after = element?.nextElementSibling;
  const pane = before?.hasAttribute("data-sized") ? before : after;
  const parent = element?.parentElement;
  if (!element || !parent || !(pane instanceof HTMLElement) || !pane.hasAttribute("data-sized"))
    return null;
  const length = (target: Element) => {
    const rect = target.getBoundingClientRect();
    return horizontal ? rect.width : rect.height;
  };
  const rtl = horizontal && getComputedStyle(element).direction === "rtl";
  // The pane can grow by what the flexible panes can give up: their size above their
  // minimum. Panes with a size of their own and the other dividers keep theirs.
  let room = length(pane);
  for (const other of parent.children)
    if (other.matches("[data-pane]:not([data-sized])"))
      room += Math.max(0, length(other) - Number((other as HTMLElement).dataset.minSize));
  const max = pane.dataset.maxSize;
  return {
    element,
    pane,
    collapsible: pane.dataset.collapsible !== undefined,
    size: length(pane),
    min: Number(pane.dataset.minSize) || 0,
    max: max === undefined ? room : Math.min(Number(max), room),
    sign: (pane === before) === !rtl ? 1 : -1,
  };
}

// Tell assistive technology where the divider is, and which pane it resizes.
function describe(state: ReturnType<typeof measure>) {
  if (!state) return;
  state.element.setAttribute("aria-controls", state.pane.id);
  state.element.setAttribute("aria-valuenow", String(Math.round(state.size)));
  state.element.setAttribute("aria-valuemin", String(state.collapsible ? 0 : state.min));
  state.element.setAttribute("aria-valuemax", String(Math.round(state.max)));
}

/**
 * The divider between two panes: a focusable `separator` that resizes the sized pane before
 * it, or else the one after it, by dragging and with the keyboard, and names that pane with
 * `aria-controls`. Give it an `aria-label` that says what it resizes. Between two panes
 * without a size it resizes nothing: it is then disabled and no tab stop.
 */
export function SplitViewDivider({
  disabled = false,
  tabIndex = 0,
  className,
  onPointerDown,
  onPointerMove,
  onLostPointerCapture,
  onMouseDown,
  onKeyDown,
  onDoubleClick,
  onFocus,
  ...props
}: SplitViewDividerProps) {
  const context = useContext(SplitViewContext);
  const horizontal = context?.orientation !== "vertical";
  const drag = useRef<{ start: number; size: number; pointer: number } | null>(null);
  // Size to return to when a collapsed pane is opened again.
  const restore = useRef(0);

  const resize = (wanted: number, state: NonNullable<ReturnType<typeof measure>>) => {
    let next = Math.min(Math.max(wanted, state.min), state.max);
    if (state.collapsible && wanted < state.min / 2) next = 0;
    next = Math.round(next);
    if (next > 0) restore.current = next;
    // The pane is laid out before the value is announced: its owner may not take the size.
    if (next !== Math.round(state.size))
      flushSync(() => context?.panes.get(state.pane.dataset.pane ?? "")?.(next));
    describe(measure(state.element, horizontal));
  };

  const toggle = (state: NonNullable<ReturnType<typeof measure>>) => {
    if (!state.collapsible) return;
    if (state.size > 0) {
      restore.current = state.size;
      resize(0, state);
    } else resize(restore.current || state.min || state.max / 2, state);
  };

  // The value a separator must have, before any input: read once the panes are laid out,
  // and again when the split view or any of its panes changes size.
  const generated = useId();
  const id = props.id ?? generated;
  useEffect(() => {
    const element = document.getElementById(id);
    // A divider that is disabled while it is dragged lets go of the pointer.
    if (disabled && drag.current) {
      element?.releasePointerCapture?.(drag.current.pointer);
      element?.removeAttribute("data-dragging");
      drag.current = null;
    }
    const update = () => {
      const state = measure(element, horizontal);
      describe(state);
      // With no sized pane beside it the divider resizes nothing: until it has one it is
      // disabled and no tab stop. With one it is the tab stop the caller asked for.
      if (!element || disabled) return;
      element.tabIndex = state ? tabIndex : -1;
      if (state) element.removeAttribute("aria-disabled");
      else {
        element.setAttribute("aria-disabled", "true");
        element.removeAttribute("aria-controls");
      }
    };
    update();
    const parent = element?.parentElement;
    const stops = parent
      ? [parent, ...parent.children].map((observed) => observeResize(observed, update))
      : [];
    return () => {
      for (const stop of stops) stop();
    };
  });

  const position = (event: PointerEvent) => (horizontal ? event.clientX : event.clientY);
  const end = (event: PointerEvent<HTMLDivElement>) => {
    // Only the pointer that started the drag ends it.
    if (drag.current?.pointer !== event.pointerId) return;
    drag.current = null;
    event.currentTarget.removeAttribute("data-dragging");
  };

  return (
    // biome-ignore lint/a11y/useSemanticElements: a window splitter is a focusable separator with a value; hr cannot hold one
    <div
      id={id}
      role="separator"
      aria-orientation={horizontal ? "vertical" : "horizontal"}
      aria-valuenow={0}
      aria-disabled={disabled || undefined}
      tabIndex={disabled ? undefined : tabIndex}
      data-disabled={disabled ? "" : undefined}
      className={className ? `mac-split-view-divider ${className}` : "mac-split-view-divider"}
      onPointerDown={(event) => {
        onPointerDown?.(event);
        // While one pointer drags, a press of another is ignored.
        const state =
          disabled || drag.current || event.button !== 0 || event.defaultPrevented
            ? null
            : measure(event.currentTarget, horizontal);
        if (!state) return;
        event.currentTarget.setPointerCapture?.(event.pointerId);
        event.currentTarget.setAttribute("data-dragging", "");
        drag.current = {
          start: position(event) * state.sign,
          size: state.size,
          pointer: event.pointerId,
        };
      }}
      onMouseDown={(event) => {
        onMouseDown?.(event);
        // Chromium can begin a native drag from this press, of a draggable row beside the divider or
        // of a selection in the page, and then cancels the pointer that was resizing the pane.
        if (disabled || event.button !== 0) return;
        event.preventDefault();
        event.currentTarget.focus({ preventScroll: true });
      }}
      onPointerMove={(event) => {
        onPointerMove?.(event);
        const state =
          drag.current?.pointer === event.pointerId &&
          !event.defaultPrevented &&
          measure(event.currentTarget, horizontal);
        if (drag.current && state)
          resize(drag.current.size + position(event) * state.sign - drag.current.start, state);
      }}
      // The divider loses the pointer when it is released or cancelled, and when something
      // else takes it: the drag is over.
      onLostPointerCapture={(event) => {
        onLostPointerCapture?.(event);
        end(event);
      }}
      onDoubleClick={(event) => {
        onDoubleClick?.(event);
        const state =
          disabled || event.defaultPrevented ? null : measure(event.currentTarget, horizontal);
        if (state) toggle(state);
      }}
      onFocus={(event) => {
        onFocus?.(event);
        describe(measure(event.currentTarget, horizontal));
      }}
      onKeyDown={(event: KeyboardEvent<HTMLDivElement>) => {
        onKeyDown?.(event);
        const state =
          disabled || event.defaultPrevented ? null : measure(event.currentTarget, horizontal);
        if (!state) return;
        if (event.key === (horizontal ? "ArrowRight" : "ArrowDown"))
          resize(state.size + STEP * state.sign, state);
        else if (event.key === (horizontal ? "ArrowLeft" : "ArrowUp"))
          resize(state.size - STEP * state.sign, state);
        else if (event.key === "Home") resize(state.min, state);
        else if (event.key === "End") resize(state.max, state);
        else if (event.key === "Enter") toggle(state);
        else return;
        event.preventDefault();
      }}
      {...props}
    />
  );
}
