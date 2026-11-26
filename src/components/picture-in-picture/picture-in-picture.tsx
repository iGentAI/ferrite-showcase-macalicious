"use client";

import { Button } from "@base-ui/react/button";
import {
  type ComponentProps,
  type CSSProperties,
  type PointerEvent,
  useEffect,
  useRef,
} from "react";
import { cn } from "../../lib/cn";
import { useControlled } from "../../lib/use-controlled";
import "./picture-in-picture.tokens.css";
import "./picture-in-picture.css";

type Corner = "top-left" | "top-right" | "bottom-left" | "bottom-right";

// The arrow keys: which half of the corner's name each one sets, and to what.
const KEYS: Record<string, [0 | 1, string]> = {
  ArrowUp: [0, "top"],
  ArrowDown: [0, "bottom"],
  ArrowLeft: [1, "left"],
  ArrowRight: [1, "right"],
};

// What keeps its own presses inside the video: a press there never moves the window.
const INTERACTIVE = "a,button,input,select,textarea,summary,[controls],[contenteditable]";

// Glyphs on a 16 pt grid, original drawings: a cross, an arrow into a frame, play and pause.
const GLYPHS = {
  close: "M4 4l8 8m0-8l-8 8",
  return: "M9 2H2v9h12V7M14 2l-5 5m0-3.5V7h3.5",
  play: "M5 3v10l8.5-5z",
  pause: "M4 3h3v10H4zm5 0h3v10H9z",
};

export interface PictureInPictureProps extends ComponentProps<"div"> {
  /** Whether the window is shown, controlled. */
  open?: boolean;
  /**
   * Whether the window is shown at first.
   * @default true
   */
  defaultOpen?: boolean;
  /** Called with `false` when the close button, the return button or Escape closes it. */
  onOpenChange?: (open: boolean) => void;
  /** The corner of the screen the window sits in, controlled. */
  corner?: "top-left" | "top-right" | "bottom-left" | "bottom-right";
  /**
   * The corner the window sits in at first.
   * @default "top-right"
   */
  defaultCorner?: "top-left" | "top-right" | "bottom-left" | "bottom-right";
  /** Called when the window is dropped in another corner, or an arrow key moves it there. */
  onCornerChange?: (corner: "top-left" | "top-right" | "bottom-left" | "bottom-right") => void;
  /** The width in points, controlled. The height follows from `aspectRatio`. */
  width?: number;
  /**
   * The width at first: Catalina opens the window at about a quarter of the screen's width.
   * @default 420
   */
  defaultWidth?: number;
  /** Called with the new width when a resize ends, and when + or - changes it. */
  onWidthChange?: (width: number) => void;
  /**
   * The narrowest the window can be made.
   * @default 210
   */
  minWidth?: number;
  /**
   * The widest the window can be made.
   * @default 840
   */
  maxWidth?: number;
  /**
   * Width divided by height: the video's own ratio.
   * @default 16 / 9
   */
  aspectRatio?: number;
  /** Whether the video is playing, controlled: the middle button then pauses. */
  playing?: boolean;
  /**
   * Whether the video is playing at first.
   * @default true
   */
  defaultPlaying?: boolean;
  /** Called when the middle button is activated, with the state it asks for. */
  onPlayingChange?: (playing: boolean) => void;
  /** Called when the return button is activated, before the window closes. */
  onReturn?: () => void;
}

/**
 * The Picture in Picture window: a video that floats in a corner of the positioned element it
 * is in. Children are the video. Under the pointer, or with keyboard focus inside, it shows
 * close, return-to-window and play or pause buttons. Drag it to another corner, or use the
 * arrow keys with focus on a button; drag its free corner, or use + and -, to resize it;
 * Escape closes it.
 */
export function PictureInPicture({
  open: openProp,
  defaultOpen = true,
  onOpenChange,
  corner: cornerProp,
  defaultCorner = "top-right",
  onCornerChange,
  width: widthProp,
  defaultWidth = 420,
  onWidthChange,
  minWidth = 210,
  maxWidth = 840,
  aspectRatio = 16 / 9,
  playing: playingProp,
  defaultPlaying = true,
  onPlayingChange,
  onReturn,
  className,
  style,
  children,
  onPointerDown,
  onPointerMove,
  onPointerUp,
  onPointerCancel,
  onPointerLeave,
  onLostPointerCapture,
  onKeyDown,
  ...props
}: PictureInPictureProps) {
  const [open, setOpen] = useControlled(openProp, defaultOpen, onOpenChange);
  const [corner, setCorner] = useControlled<Corner>(cornerProp, defaultCorner, onCornerChange);
  const [rawWidth, setWidth] = useControlled(widthProp, defaultWidth, onWidthChange);
  const [playing, setPlaying] = useControlled(playingProp, defaultPlaying, onPlayingChange);
  const clamp = (value: number) => Math.round(Math.min(maxWidth, Math.max(minWidth, value)));
  // The width shown is within the limits, whatever was given and whenever they change.
  const width = clamp(rawWidth);
  // A gesture: its pointer, where the pointer started, how far it has moved, and for a resize
  // the width so far. It is `active` once the pointer has moved far enough to be a drag.
  // `grow` is 0 for a move and, for a resize, 1 or -1: the way a pointer
  // moving right changes the width. `cx` and `cy` place the window's centre from the centre
  // of the element it is positioned in.
  const drag = useRef<{
    pointer: number;
    x: number;
    y: number;
    dx: number;
    dy: number;
    grow: number;
    cx: number;
    cy: number;
    width: number;
    active: boolean;
  } | null>(null);

  // A window closed during a gesture takes the gesture with it: its element is gone, and no
  // pointer event will end it.
  useEffect(() => {
    if (!open) drag.current = null;
  }, [open]);

  const place = (next: string) => {
    if (next !== corner) setCorner(next as Corner);
  };
  const resize = (next: number) => {
    if (clamp(next) !== width) setWidth(clamp(next));
  };

  // The gesture ends when the pointer is released, cancelled or taken away: commit once.
  const end = (event: PointerEvent<HTMLDivElement>) => {
    const state = drag.current;
    if (state?.pointer !== event.pointerId) return;
    drag.current = null;
    const element = event.currentTarget;
    element.removeAttribute("data-dragging");
    element.style.removeProperty("--_drag");
    element.style.removeProperty("--_resize");
    if (state.grow) resize(state.width);
    // The window snaps to the corner of the quarter its centre was dropped in.
    else if (state.dx || state.dy)
      place(
        `${state.cy + state.dy < 0 ? "top" : "bottom"}-${state.cx + state.dx < 0 ? "left" : "right"}`,
      );
  };

  const button = (kind: string, glyph: keyof typeof GLYPHS, label: string, act: () => void) => (
    <Button
      className="mac-picture-in-picture-button"
      data-kind={kind}
      aria-label={label}
      onClick={act}
    >
      <svg className="mac-picture-in-picture-glyph" viewBox="0 0 16 16" aria-hidden="true">
        <path d={GLYPHS[glyph]} />
      </svg>
    </Button>
  );

  return open ? (
    // biome-ignore lint/a11y/useSemanticElements: a floating video window is a labelled group, not a form's fieldset
    <div
      role="group"
      aria-label="Picture in Picture"
      data-corner={corner}
      data-playing={playing ? "" : undefined}
      className={cn("mac-picture-in-picture", className)}
      style={{ "--_width": `${width}px`, "--_ratio": aspectRatio, ...style } as CSSProperties}
      onPointerDown={(event) => {
        onPointerDown?.(event);
        const target = event.target as Element;
        const element = event.currentTarget;
        if (drag.current || event.button !== 0 || event.defaultPrevented) return;
        // The window's buttons, and links and controls in the video, keep their presses.
        if (element.contains(target.closest(INTERACTIVE))) return;
        // The only layout reads of the gesture: the window and the element it is placed in.
        const rect = element.getBoundingClientRect();
        const area = (
          element.offsetParent ??
          element.parentElement ??
          element
        ).getBoundingClientRect();
        drag.current = {
          pointer: event.pointerId,
          x: event.clientX,
          y: event.clientY,
          dx: 0,
          dy: 0,
          grow: target.closest(".mac-picture-in-picture-resize")
            ? corner.endsWith("left")
              ? 1
              : -1
            : 0,
          cx: rect.left + rect.width / 2 - area.left - area.width / 2,
          cy: rect.top + rect.height / 2 - area.top - area.height / 2,
          width,
          active: false,
        };
      }}
      onPointerMove={(event) => {
        onPointerMove?.(event);
        const state = drag.current;
        if (state?.pointer !== event.pointerId) return;
        const element = event.currentTarget;
        const dx = event.clientX - state.x;
        const dy = event.clientY - state.y;
        // A press becomes a drag once the pointer has moved 4 points. Until then nothing is
        // captured, so a click still reaches what was pressed in the video.
        if (!state.active) {
          if (Math.abs(dx) + Math.abs(dy) < 4) return;
          state.active = true;
          element.setPointerCapture?.(state.pointer);
          element.setAttribute("data-dragging", "");
        }
        const css = element.style;
        state.dx = dx;
        state.dy = dy;
        if (state.grow) {
          state.width = clamp(width + state.dx * state.grow);
          css.setProperty("--_resize", `${state.width}px`);
        } else css.setProperty("--_drag", `${state.dx}px ${state.dy}px`);
      }}
      onPointerUp={(event) => {
        onPointerUp?.(event);
        end(event);
      }}
      onPointerCancel={(event) => {
        onPointerCancel?.(event);
        end(event);
      }}
      onPointerLeave={(event) => {
        onPointerLeave?.(event);
        // A press that left before it became a drag is over: nothing was captured.
        const state = drag.current;
        if (state && !state.active && state.pointer === event.pointerId) drag.current = null;
      }}
      onLostPointerCapture={(event) => {
        onLostPointerCapture?.(event);
        end(event);
      }}
      onKeyDown={(event) => {
        onKeyDown?.(event);
        if (event.defaultPrevented || event.ctrlKey || event.metaKey || event.altKey) return;
        // The arrow keys, + and - are for focus on the window's own buttons: in the video they
        // are the video's. Escape closes from anywhere inside.
        const own = (event.target as Element).closest(".mac-picture-in-picture-controls");
        const key = own && KEYS[event.key];
        if (key) {
          const parts = corner.split("-");
          parts[key[0]] = key[1];
          place(parts.join("-"));
        } else if (own && (event.key === "+" || event.key === "=")) resize(width + 32);
        else if (own && event.key === "-") resize(width - 32);
        else if (event.key === "Escape") setOpen(false);
        else return;
        event.preventDefault();
      }}
      {...props}
    >
      <div className="mac-picture-in-picture-video">{children}</div>
      <div className="mac-picture-in-picture-controls">
        {button("close", "close", "Close", () => setOpen(false))}
        {button("return", "return", "Return to Window", () => {
          onReturn?.();
          setOpen(false);
        })}
        {button("play", playing ? "pause" : "play", playing ? "Pause" : "Play", () =>
          setPlaying(!playing),
        )}
      </div>
      <div className="mac-picture-in-picture-resize" />
    </div>
  ) : null;
}
