"use client";

import {
  Children,
  type ComponentProps,
  type CSSProperties,
  createContext,
  isValidElement,
  type PointerEvent,
  use,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
} from "react";
import { cn } from "../../lib/cn";
import { useControlled } from "../../lib/use-controlled";
import { Window, type WindowProps } from "../window";
import "./split-view-full-screen.tokens.css";
import "./split-view-full-screen.css";

type Side = "leading" | "trailing";

const SplitViewFullScreenContext = createContext<{
  id: string;
  setLeadingId: (id: string | undefined) => void;
  split: number;
  setSplit: (split: number) => void;
  min: number;
  max: number;
  active: Side;
  setActive: (active: Side) => void;
} | null>(null);

export interface SplitViewFullScreenProps extends ComponentProps<"div"> {
  /** The leading tile's share of the width the divider leaves, from 0 to 1, controlled. */
  split?: number;
  /**
   * The share the leading tile starts with.
   * @default 0.5
   */
  defaultSplit?: number;
  /**
   * Called with the new share: once when a drag of the divider ends, and on each key that
   * moves it.
   */
  onSplitChange?: (split: number) => void;
  /**
   * The smallest share of the leading tile. Catalina takes it from the application's minimum
   * window width.
   * @default 0.25
   */
  min?: number;
  /**
   * The largest share of the leading tile.
   * @default 0.75
   */
  max?: number;
  /** The tile that is active, controlled: its window is key and the other one inactive. */
  active?: "leading" | "trailing";
  /**
   * The tile that is active at first.
   * @default "leading"
   */
  defaultActive?: "leading" | "trailing";
  /** Called when a press or keyboard focus in the other tile makes it the active one. */
  onActiveChange?: (active: "leading" | "trailing") => void;
}

/**
 * Split View: two full-screen windows share a Space, with a black divider between them. Its
 * children are a leading `SplitViewFullScreenTile`, a `SplitViewFullScreenDivider` and a
 * trailing tile, in that order. Give it the size of the screen.
 */
export function SplitViewFullScreen({
  split: splitProp,
  defaultSplit = 0.5,
  onSplitChange,
  min = 0.25,
  max = 0.75,
  active: activeProp,
  defaultActive = "leading",
  onActiveChange,
  className,
  style,
  children,
  ...props
}: SplitViewFullScreenProps) {
  const generatedId = useId();
  // The leading tile's own id, when it was given one: the divider names whichever it has.
  // It is read from the children, so that markup rendered on the server has it too; a tile
  // that is not a direct child reports its id once it has mounted.
  const [reportedId, setLeadingId] = useState<string>();
  let leadingId = reportedId;
  Children.forEach(children, (child) => {
    if (isValidElement<SplitViewFullScreenTileProps>(child) && child.props.side === "leading") {
      leadingId = child.props.id ?? leadingId;
    }
  });
  const id = leadingId ?? generatedId;
  const [rawSplit, setSplit] = useControlled(splitProp, defaultSplit, onSplitChange);
  // The share shown is within the limits, whatever was given and whenever they change.
  const split = Math.min(max, Math.max(min, rawSplit));
  const [active, setActive] = useControlled(activeProp, defaultActive, onActiveChange);
  const context = useMemo(
    () => ({ id, setLeadingId, split, setSplit, min, max, active, setActive }),
    [id, split, setSplit, min, max, active, setActive],
  );
  return (
    <SplitViewFullScreenContext value={context}>
      <div
        data-active={active}
        className={cn("mac-split-view-full-screen", className)}
        style={{ "--_split": split, ...style } as CSSProperties}
        {...props}
      >
        {children}
      </div>
    </SplitViewFullScreenContext>
  );
}

export interface SplitViewFullScreenTileProps
  extends Omit<WindowProps, "state" | "variant" | "fullScreen" | "width" | "height"> {
  /** Which tile this is: the leading one comes first, on the left in a left-to-right page. */
  side: "leading" | "trailing";
}

/**
 * One tile: a full-screen `Window` that is key while its side is the active one and inactive
 * otherwise. Its children are the window's: a title bar and a body. A press or keyboard focus
 * inside makes it the active tile.
 */
export function SplitViewFullScreenTile({
  side,
  id,
  className,
  onPointerDown,
  onFocus,
  ...props
}: SplitViewFullScreenTileProps) {
  const context = use(SplitViewFullScreenContext);
  const leading = side === "leading";
  const setLeadingId = context?.setLeadingId;
  // The divider names the leading tile in aria-controls: tell it an id given here.
  useEffect(() => {
    if (!leading || !id) return;
    setLeadingId?.(id);
    return () => setLeadingId?.(undefined);
  }, [setLeadingId, leading, id]);
  const activate = () => {
    if (context && context.active !== side) context.setActive(side);
  };
  return (
    <Window
      fullScreen
      state={context && context.active !== side ? "inactive" : "key"}
      id={id ?? (leading ? context?.id : undefined)}
      data-side={side}
      className={cn("mac-split-view-full-screen-tile", className)}
      onPointerDown={(event) => {
        onPointerDown?.(event);
        activate();
      }}
      onFocus={(event) => {
        onFocus?.(event);
        activate();
      }}
      {...props}
    />
  );
}

export interface SplitViewFullScreenDividerProps extends ComponentProps<"div"> {
  /**
   * The share of the width an arrow key moves the divider.
   * @default 0.01
   */
  step?: number;
}

/**
 * The divider between the tiles: a focusable `separator` whose value is the leading tile's
 * share in percent. Drag it, or use the arrow keys, Home and End; a double click makes the
 * tiles equal.
 */
export function SplitViewFullScreenDivider({
  step = 0.01,
  className,
  onPointerDown,
  onPointerMove,
  onLostPointerCapture,
  onPointerUp,
  onPointerCancel,
  onDoubleClick,
  onKeyDown,
  ...props
}: SplitViewFullScreenDividerProps) {
  const context = use(SplitViewFullScreenContext);
  const { split = 0.5, min = 0, max = 1 } = context ?? {};
  // A drag: its pointer, where it started, the width one whole share is, and the share so far.
  const drag = useRef<{ pointer: number; x: number; width: number; next: number } | null>(null);
  const clamp = (value: number) => Math.round(Math.min(max, Math.max(min, value)) * 1e4) / 1e4;
  // A share that is the present one is not reported.
  const set = (value: number) => {
    const next = clamp(value);
    if (next !== split) context?.setSplit(next);
  };
  // 1 where the leading tile is on the left, -1 in a right-to-left page.
  const direction = (element: Element) => (getComputedStyle(element).direction === "rtl" ? -1 : 1);

  // The drag ends when the pointer is released, cancelled or taken away: commit once.
  const end = (event: PointerEvent<HTMLDivElement>) => {
    const state = drag.current;
    if (state?.pointer !== event.pointerId) return;
    drag.current = null;
    const root = event.currentTarget.parentElement;
    root?.style.removeProperty("--_drag");
    root?.removeAttribute("data-dragging");
    set(state.next);
  };

  return (
    // biome-ignore lint/a11y/useSemanticElements: a window splitter is a focusable separator with a value; hr cannot hold one
    <div
      role="separator"
      aria-orientation="vertical"
      aria-label="Resize tiles"
      aria-controls={context?.id}
      aria-valuenow={Math.round(split * 100)}
      aria-valuemin={Math.round(min * 100)}
      aria-valuemax={Math.round(max * 100)}
      tabIndex={0}
      className={cn("mac-split-view-full-screen-divider", className)}
      onPointerDown={(event) => {
        onPointerDown?.(event);
        const root = event.currentTarget.parentElement;
        // While one pointer drags, a press of another is ignored.
        if (drag.current || event.button !== 0 || event.defaultPrevented || !root) return;
        event.currentTarget.setPointerCapture?.(event.pointerId);
        root.setAttribute("data-dragging", "");
        // The only layout read of the gesture: the width the two tiles share.
        const width = root.getBoundingClientRect().width - event.currentTarget.offsetWidth;
        drag.current = {
          pointer: event.pointerId,
          x: event.clientX,
          width: width * direction(root),
          next: split,
        };
      }}
      onPointerMove={(event) => {
        onPointerMove?.(event);
        const state = drag.current;
        if (state?.pointer !== event.pointerId || !state.width) return;
        state.next = clamp(split + (event.clientX - state.x) / state.width);
        event.currentTarget.parentElement?.style.setProperty("--_drag", String(state.next));
      }}
      onPointerUp={(event) => {
        onPointerUp?.(event);
        end(event);
      }}
      onPointerCancel={(event) => {
        onPointerCancel?.(event);
        end(event);
      }}
      onLostPointerCapture={(event) => {
        onLostPointerCapture?.(event);
        end(event);
      }}
      onDoubleClick={(event) => {
        onDoubleClick?.(event);
        if (!event.defaultPrevented) set(0.5);
      }}
      onKeyDown={(event) => {
        onKeyDown?.(event);
        if (event.defaultPrevented || event.ctrlKey || event.metaKey || event.altKey) return;
        const move = step * direction(event.currentTarget);
        if (event.key === "ArrowRight") set(split + move);
        else if (event.key === "ArrowLeft") set(split - move);
        else if (event.key === "Home") set(min);
        else if (event.key === "End") set(max);
        else return;
        event.preventDefault();
      }}
      {...props}
    />
  );
}
