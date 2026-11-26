"use client";

import {
  type CSSProperties,
  createContext,
  type MouseEvent,
  type PointerEvent,
  type ReactNode,
  use,
  useCallback,
  useEffect,
  useId,
  useLayoutEffect,
  useMemo,
  useRef,
  useSyncExternalStore,
} from "react";
import { useControlled } from "../../lib/use-controlled";
import { Window, type WindowProps, type WindowState } from "../window";
import { useWindowManagerStore, type WindowFrame } from "../window-manager";
import "./managed-window.css";

// The eight places a window is resized from: its edges and corners, by compass point.
const EDGES = ["n", "e", "s", "w", "ne", "se", "sw", "nw"] as const;

const nothing = () => undefined;

const translate = (x: number, y: number) => `translate3d(${x}px,${y}px,0)`;

// A press or a double click in a popup of the title bar (a menu, a popover) reaches the bar
// through React though it is elsewhere on the page: it is the popup's, not the window's.
const own = (event: { currentTarget: Element; target: EventTarget }) =>
  event.currentTarget.contains(event.target as Node);

/** What `useManagedWindow()` returns. */
export interface ManagedWindowApi {
  /** The window's id in its manager. */
  id: string;
  /** Key, main or inactive. The frame already shows it; read it only to change behaviour. */
  state: WindowState;
  /** In the Dock. */
  minimized: boolean;
  /** Zoomed to the space inside the manager's insets. */
  zoomed: boolean;
  /** In full screen. */
  fullScreen: boolean;
  /** Spread onto the window's `TitleBar`: dragging it moves the window, a double click zooms. */
  titleBarProps: {
    onDragRegionPointerDown: (event: PointerEvent<HTMLElement>) => void;
    onDragRegionDoubleClick: (event: MouseEvent<HTMLElement>) => void;
  };
  /** Spread onto the window's `WindowControls`: close, minimize and zoom, with the right glyph and disabled buttons. */
  controlsProps: {
    onClose: () => void;
    onMinimize: () => void;
    onZoom: (event: MouseEvent<HTMLElement>) => void;
    zoomRole: "full-screen" | "zoom" | "exit-full-screen";
    minimizeDisabled: boolean;
    zoomDisabled: boolean;
  };
  /** Close the window. */
  close(): void;
  /** Minimize the window. */
  minimize(): void;
  /** Zoom the window, or return it to its own frame. */
  zoom(): void;
  /** Enter or leave full screen. */
  toggleFullScreen(): void;
}

const ManagedWindowContext = createContext<ManagedWindowApi | null>(null);

// The managed window a component is rendered in. (The size budget counts a doc comment here.)
export function useManagedWindow(): ManagedWindowApi {
  const api = use(ManagedWindowContext);
  if (!api) throw new Error("Render this inside a <ManagedWindow>.");
  return api;
}

export interface ManagedWindowProps extends Omit<WindowProps, "state" | "variant" | "fullScreen"> {
  /**
   * The window's id in its manager, for `useWindowManager().focus(id)` and the like. Generated
   * when omitted.
   */
  id?: string;
  /**
   * The application the window belongs to. A Dock shows one running application per value and
   * finds its icon by it. Defaults to the window's id.
   */
  app?: string;
  /**
   * The window's name in the manager's list: what a Dock, a Window menu or Mission Control
   * shows for it. The visible title is still the `TitleBar`'s.
   * @default ""
   */
  title?: string;
  /**
   * Where the window opens: `x` and `y` from the manager's top-left corner, `width`, `height`,
   * in points. Read once. Without `x` and `y` the window is cascaded below the ones already
   * open; without a size it is 480 by 320.
   */
  defaultFrame?: Partial<WindowFrame>;
  /**
   * The narrowest the window can be resized to, in points.
   * @default 160
   */
  minWidth?: number;
  /**
   * The shortest the window can be resized to, in points.
   * @default 80
   */
  minHeight?: number;
  /**
   * Whether the edges and corners resize the window and it can zoom and go full screen. A
   * window that is not resizable has a disabled zoom button, as Calculator has.
   * @default true
   */
  resizable?: boolean;
  /**
   * What the green button does: `"full-screen"`, as in most Catalina windows (hold Option to
   * zoom instead), or `"zoom"` for a window that does not support full screen.
   * @default "full-screen"
   */
  zoomButton?: "full-screen" | "zoom";
  /**
   * A utility panel: it floats above ordinary windows, takes the panel shadow, and while it is
   * key the front ordinary window stays main.
   * @default false
   */
  panel?: boolean;
  /** Whether the window is open, when you control it. A closed window is not rendered. */
  open?: boolean;
  /**
   * Whether the window starts open, when you do not control it.
   * @default true
   */
  defaultOpen?: boolean;
  /** Called with `false` when the window is closed by its close button, the keyboard or the manager. */
  onOpenChange?: (open: boolean) => void;
  /**
   * Render a component that has a `Window` as its own root, instead of the `Window` this
   * component would render: it is called with the props for that root (state, full screen,
   * size, and everything else given here) plus the props of the title bar's drag region and
   * of the window controls, which that component hands to its `TitleBar` and `WindowControls`.
   * `children` are not used then.
   */
  render?: (props: ManagedWindowRenderProps) => ReactNode;
}

/**
 * What `render` is called with: the props of a `Window`, and eight more that must be taken
 * out before the rest is spread onto that `Window`.
 */
export interface ManagedWindowRenderProps extends WindowProps {
  /** For `WindowControls`. */
  onClose: () => void;
  /** For `WindowControls`. */
  onMinimize: () => void;
  /** For `WindowControls`. */
  onZoom: (event: MouseEvent<HTMLElement>) => void;
  /** For `WindowControls`: what the green button does now. */
  zoomRole: "full-screen" | "zoom" | "exit-full-screen";
  /** For `WindowControls`: `true` in full screen. */
  minimizeDisabled: boolean;
  /** For `WindowControls`: `true` in a window that is not resizable. */
  zoomDisabled: boolean;
  /** For `TitleBar`. */
  onDragRegionPointerDown: (event: PointerEvent<HTMLElement>) => void;
  /** For `TitleBar`. */
  onDragRegionDoubleClick: (event: MouseEvent<HTMLElement>) => void;
}

// A `Window` that the surrounding `WindowManager` moves, resizes, orders and focuses.
export function ManagedWindow({
  open,
  defaultOpen = true,
  onOpenChange,
  ...props
}: ManagedWindowProps) {
  const [isOpen, setOpen] = useControlled(open, defaultOpen, onOpenChange);
  return isOpen ? <ManagedWindowFrame {...props} onClose={setOpen} /> : null;
}

interface ManagedWindowFrameProps
  extends Omit<ManagedWindowProps, "open" | "defaultOpen" | "onOpenChange"> {
  onClose: (open: false) => void;
}

function ManagedWindowFrame({
  id: idProp,
  app,
  title = "",
  defaultFrame,
  minWidth = 160,
  minHeight = 80,
  resizable = true,
  zoomButton = "full-screen",
  panel = false,
  onClose,
  render,
  children,
  ...props
}: ManagedWindowFrameProps) {
  const store = useWindowManagerStore();
  const generatedId = useId();
  const id = idProp ?? generatedId;
  const ref = useRef<HTMLDivElement>(null);
  const info = useSyncExternalStore(store.subscribe, () => store.get(id), nothing);
  const focusRequest = useSyncExternalStore(store.subscribe, () => store.focusRequest(id), nothing);

  // What the registration below reads when it runs, so that it runs once per window.
  const latest = useRef({ onClose, defaultFrame });
  useLayoutEffect(() => {
    latest.current = { onClose, defaultFrame };
  });

  useLayoutEffect(() => {
    const element = ref.current;
    const inside = (root?: Element | null) => !!root?.contains(document.activeElement);
    store.add(
      {
        id,
        app: id,
        title: "",
        panel: false,
        resizable: true,
        minWidth: 0,
        minHeight: 0,
        frame: latest.current.defaultFrame ?? {},
      },
      () => latest.current.onClose(false),
    );
    // A window opened from inside the desktop (a Dock, a menu, another window) takes the
    // keyboard focus with the key state; one that is there when the page loads, or that opens
    // while the focus is elsewhere on the page, leaves the focus where it is.
    if (inside(element?.closest(".mac-window-manager"))) store.focus(id);
    // And one that goes with the focus inside hands it to the next window.
    return () => store.remove(id, inside(element));
  }, [store, id]);

  // What can change in the life of a window, its being a panel included.
  useLayoutEffect(() => {
    store.patch(id, { app: app ?? id, title, panel, minWidth, minHeight, resizable });
  }, [store, id, app, title, panel, minWidth, minHeight, resizable]);

  const state = info?.state ?? "inactive";
  const minimized = info?.minimized ?? false;
  const away = info?.away ?? false;
  const zoomed = info?.zoomed ?? false;
  const fullScreen = info?.fullScreen ?? false;

  // A command (the Dock, a menu, the keyboard, another window closing) asks the key window to
  // take the keyboard focus; a window made key by a click or by Tab already has it.
  useEffect(() => {
    const element = ref.current;
    if (focusRequest && element && !element.contains(document.activeElement)) {
      (element.firstElementChild as HTMLElement | null)?.focus({ preventScroll: true });
    }
  }, [focusRequest]);

  // Where a minimizing window shrinks to: the element marked as the target (a Dock marks
  // itself); without one the stylesheet sends it down. One read, after the commit.
  useLayoutEffect(() => {
    const element = ref.current;
    if (!minimized || !element) return;
    const to = element
      .closest(".mac-window-manager")
      ?.querySelector("[data-window-minimize-target]")
      ?.getBoundingClientRect();
    if (!to) return;
    const from = element.getBoundingClientRect();
    const x = to.left + to.width / 2 - from.left - from.width / 2;
    const y = to.top + to.height / 2 - from.top - from.height / 2;
    element.style.setProperty("--_minimize-x", `${x}px`);
    element.style.setProperty("--_minimize-y", `${y}px`);
  }, [minimized]);

  // The gesture in progress ends when the window goes or its handles do (it stops being
  // resizable, zooms, enters full screen): no listener is left on an element that is gone,
  // and the window is not left marked as dragging. What the gesture reached is kept.
  const gesture = useRef<(() => void) | null>(null);
  // biome-ignore lint/correctness/useExhaustiveDependencies: these three decide whether there are handles.
  useLayoutEffect(() => () => gesture.current?.(), [resizable, zoomed, fullScreen]);

  // Follow the pointer from a press on the title bar (no edges) or on a resize handle.
  const track = useCallback(
    (event: PointerEvent<HTMLElement>, edges = "") => {
      const element = ref.current;
      const stage = element?.closest(".mac-window-manager");
      const current = store.get(id);
      // One gesture at a time: a second finger on the window does not start another.
      if (
        !element ||
        !stage ||
        !current ||
        current.fullScreen ||
        event.button !== 0 ||
        !own(event) ||
        element.hasAttribute("data-dragging")
      ) {
        return;
      }
      // The only layout read of the gesture; every pointer move after it only writes.
      const stageWidth = stage.clientWidth;
      const stageHeight = stage.clientHeight;
      const { top, right, bottom, left } = store.insets;
      const start: WindowFrame = current.zoomed
        ? {
            x: left,
            y: top,
            width: stageWidth - left - right,
            height: stageHeight - top - bottom,
          }
        : current.frame;
      let frame = start;
      const handle = event.currentTarget;
      const pointer = event.pointerId;
      const pointerX = event.clientX;
      const pointerY = event.clientY;
      const farX = start.x + start.width;
      const farY = start.y + start.height;
      const { minWidth, minHeight } = current;
      const within = store.bound(start, stageWidth, stageHeight) === start;

      const move = (e: globalThis.PointerEvent) => {
        if (e.pointerId !== pointer) return;
        const dx = e.clientX - pointerX;
        const dy = e.clientY - pointerY;
        let { x, y, width, height } = start;
        if (!edges) {
          x += dx;
          y += dy;
        }
        if (edges.includes("e")) width = Math.max(minWidth, width + dx);
        if (edges.includes("s")) height = Math.max(minHeight, height + dy);
        if (edges.includes("w")) {
          width = Math.max(minWidth, width - dx);
          x = farX - width;
        }
        if (edges.includes("n")) {
          height = Math.max(minHeight, farY - Math.max(top, y + dy));
          y = farY - height;
        }
        // The title bar stays within reach, as in AppKit: a move stops at the bounds, and a
        // resize that would take a window that is within them out of them is not made.
        const next = { x, y, width, height };
        const bounded = store.bound(next, stageWidth, stageHeight);
        if (edges && within && bounded !== next) return;
        frame = edges ? next : bounded;
        element.style.transform = translate(frame.x, frame.y);
        if (edges) {
          element.style.width = `${width}px`;
          element.style.height = `${height}px`;
        }
      };
      // A drag also ends when the browser cancels the pointer or takes the capture away.
      const ends = ["pointerup", "pointercancel", "lostpointercapture"] as const;
      const finish = (released = false) => {
        gesture.current = null;
        handle.removeEventListener("pointermove", move);
        for (const type of ends) handle.removeEventListener(type, end);
        element.removeAttribute("data-dragging");
        // An interrupted gesture keeps its frame and leaves a zoom as it finds it.
        if (frame !== start) store.patch(id, released ? { frame, zoomed: false } : { frame });
      };
      const end = (e: globalThis.PointerEvent) => {
        if (e.pointerId === pointer) finish(true);
      };
      gesture.current = finish;
      // Not every environment that renders components has pointer capture.
      handle.setPointerCapture?.(pointer);
      handle.addEventListener("pointermove", move);
      for (const type of ends) handle.addEventListener(type, end);
      element.setAttribute("data-dragging", "");
      // A press on a handle must not start a text selection in the window beside it; that
      // also keeps the browser from moving the keyboard focus, so the window is asked to.
      if (edges) {
        event.preventDefault();
        store.focus(id);
      }
    },
    [store, id],
  );

  const api = useMemo<ManagedWindowApi>(() => {
    const close = () => store.close(id);
    const minimize = () => store.minimize(id);
    const zoom = () => store.zoom(id);
    const toggleFullScreen = () => store.toggleFullScreen(id);
    // The green button enters full screen: a window that is not resizable has no full screen.
    const fullScreenButton = resizable && zoomButton === "full-screen";
    return {
      id,
      state,
      minimized,
      zoomed,
      fullScreen,
      titleBarProps: {
        onDragRegionPointerDown: track,
        onDragRegionDoubleClick: (event) => own(event) && zoom(),
      },
      controlsProps: {
        onClose: close,
        onMinimize: minimize,
        // The green button: full screen, or zoom with Option held, as in Catalina.
        // A window that is not resizable has no full screen: its button, enabled only
        // while the window is still zoomed, leaves the zoom.
        onZoom: (event) =>
          fullScreen || (fullScreenButton && !event.altKey) ? toggleFullScreen() : zoom(),
        zoomRole: fullScreen ? "exit-full-screen" : fullScreenButton ? "full-screen" : "zoom",
        minimizeDisabled: fullScreen,
        // Leaving full screen or a zoom stays possible in a window that is no longer resizable.
        zoomDisabled: !resizable && !fullScreen && !zoomed,
      },
      close,
      minimize,
      zoom,
      toggleFullScreen,
    };
  }, [store, id, state, minimized, zoomed, fullScreen, resizable, zoomButton, track]);

  // A zoomed or full-screen window is placed by the stylesheet, from the manager's insets.
  const frame = info?.frame;
  const style: CSSProperties | undefined =
    fullScreen || zoomed
      ? undefined
      : {
          transform: translate(frame?.x ?? defaultFrame?.x ?? 0, frame?.y ?? defaultFrame?.y ?? 0),
          width: frame?.width ?? defaultFrame?.width ?? 480,
          height: frame?.height ?? defaultFrame?.height ?? 320,
        };

  const windowProps: WindowProps = {
    tabIndex: -1,
    ...props,
    state,
    variant: panel ? "panel" : "standard",
    fullScreen,
  };

  return (
    <div
      ref={ref}
      className="mac-managed-window"
      data-window-id={id}
      data-minimized={minimized ? "" : undefined}
      data-away={away ? "" : undefined}
      data-zoomed={zoomed ? "" : undefined}
      data-full-screen={fullScreen ? "" : undefined}
      inert={minimized || away}
      style={{ ...style, zIndex: info?.z }}
      // A press or focus in the frame brings it to the front, out of the Dock. Only in the frame itself: React hands
      // the frame the events of everything the window renders elsewhere through a portal (an application's further
      // window, such as Calculator's Paper Tape, or a popup), and focus moving into such a window when this one is
      // minimized must not bring this one back.
      onPointerDownCapture={(event) => own(event) && store.raise(id)}
      onFocusCapture={(event) => own(event) && store.raise(id)}
    >
      <ManagedWindowContext value={api}>
        {render ? (
          render({
            ...windowProps,
            ...api.titleBarProps,
            ...api.controlsProps,
            width: "100%",
            height: "100%",
          })
        ) : (
          <Window {...windowProps}>{children}</Window>
        )}
      </ManagedWindowContext>
      {resizable && !fullScreen && !zoomed
        ? EDGES.map((edge) => (
            <div
              key={edge}
              className="mac-managed-window-resize"
              data-edge={edge}
              aria-hidden="true"
              onPointerDown={(event) => track(event, edge)}
            />
          ))
        : null}
    </div>
  );
}
