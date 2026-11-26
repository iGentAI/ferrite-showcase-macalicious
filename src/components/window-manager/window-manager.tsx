"use client";

import {
  type ComponentProps,
  createContext,
  type KeyboardEvent,
  use,
  useInsertionEffect,
  useMemo,
  useState,
  useSyncExternalStore,
} from "react";
import { cn } from "../../lib/cn";
import {
  createWindowManagerStore,
  type ManagedWindowInfo,
  noWindows,
  type WindowManagerInsets,
  type WindowManagerStore,
} from "./store";
import "./window-manager.css";

const WindowManagerContext = createContext<WindowManagerStore | null>(null);

const ARROWS = ["ArrowLeft", "ArrowUp", "ArrowRight", "ArrowDown"];

// Points a window moves or grows per press of an arrow key: 16.

// The surrounding manager's store: what ManagedWindow is built with. Documented on the page.
export function useWindowManagerStore(): WindowManagerStore {
  const store = use(WindowManagerContext);
  if (!store) throw new Error("Needs a <WindowManager>.");
  return store;
}

export interface WindowManagerProps extends ComponentProps<"div"> {
  /**
   * Space, in points, that windows keep clear of at each edge: `top` for a menu bar, `bottom`
   * (or `left`, `right`) for a Dock. A zoomed window fills what is left, and no title bar can
   * be dragged above `top`. A full-screen window ignores it.
   */
  insets?: WindowManagerInsets;
}

// The desktop that managed windows live on. (The size budget counts a doc comment here.)
export function WindowManager({
  insets,
  className,
  style,
  onKeyDown,
  ...props
}: WindowManagerProps) {
  const [store] = useState(createWindowManagerStore);
  const { top = 0, right = 0, bottom = 0, left = 0 } = insets ?? {};
  const edges = { top, right, bottom, left };

  // Windows read the insets from their handlers and when they register, in a layout effect.
  // An insertion effect is part of the commit and runs before every layout effect of the tree,
  // so the store holds what is on screen and never the insets of a render that was abandoned.
  useInsertionEffect(() => {
    store.insets = edges;
  });

  // Window commands for the key window, with Control-Option or Control-Command held: arrows
  // move, Shift-arrows resize, M minimizes, W closes, Z zooms, F is full screen and ` goes to
  // the next window. Read by key position, since Option changes the character.
  const handleKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    onKeyDown?.(event);
    const key = store.list().find((w) => w.state === "key");
    // AltGr, which types characters, is Control and Option to some browsers: not a command.
    if (
      !key ||
      event.defaultPrevented ||
      !event.ctrlKey ||
      !(event.altKey || event.metaKey) ||
      event.getModifierState("AltGraph")
    ) {
      return;
    }
    const { code, shiftKey } = event;
    const arrow = ARROWS.indexOf(code);
    if (arrow >= 0) {
      if (key.fullScreen || (shiftKey && (key.zoomed || !key.resizable))) return;
      const delta = arrow < 2 ? -16 : 16;
      const vertical = arrow % 2;
      // The desktop is measured once per press. The insets are this render's, which is the
      // one on screen.
      const { clientWidth, clientHeight } = event.currentTarget;
      // A zoomed window moves from where it is drawn and leaves its zoom, as when it is dragged.
      const frame = key.zoomed
        ? {
            x: left,
            y: top,
            width: clientWidth - left - right,
            height: clientHeight - top - bottom,
          }
        : { ...key.frame };
      if (shiftKey && vertical) frame.height = Math.max(key.minHeight, frame.height + delta);
      else if (shiftKey) frame.width = Math.max(key.minWidth, frame.width + delta);
      else if (vertical) frame.y += delta;
      else frame.x += delta;
      // The same bounds as a drag: a move stops at them, and a resize that would take the
      // title bar of a window that is within them out of reach is not made.
      const bounded = store.bound(frame, clientWidth, clientHeight);
      if (
        shiftKey &&
        bounded !== frame &&
        store.bound(key.frame, clientWidth, clientHeight) === key.frame
      )
        return;
      store.patch(key.id, { frame: shiftKey ? frame : bounded, zoomed: false });
      // Given from a Dock or a menu, the command takes the keyboard focus into the window,
      // as the other commands do.
      store.focus(key.id);
    } else if (code === "KeyM") store.minimize(key.id);
    else if (code === "KeyW") store.close(key.id);
    else if (code === "KeyZ") store.zoom(key.id);
    else if (code === "KeyF") store.toggleFullScreen(key.id);
    else if (code === "Backquote") store.cycle(shiftKey);
    else return;
    event.preventDefault();
  };

  const css: Record<string, string> = {};
  for (const edge in edges) {
    css[`--mac-window-manager-inset-${edge}`] = `${edges[edge as keyof typeof edges]}px`;
  }

  return (
    <WindowManagerContext value={store}>
      {/* biome-ignore lint/a11y/noStaticElementInteractions: the desktop hears the window commands of whatever inside it has the keyboard focus; it is not itself a control. */}
      <div
        className={cn("mac-window-manager", className)}
        style={{ ...css, ...style }}
        onKeyDown={handleKeyDown}
        {...props}
      />
    </WindowManagerContext>
  );
}

/** What `useWindowManager()` returns. */
export interface WindowManagerApi {
  /**
   * Every open window, minimized ones included, in the order they were last key: the key window
   * is the last one that is not minimized. Each record is replaced when it changes.
   */
  windows: readonly ManagedWindowInfo[];
  /** The id of the key window, if any window is showing. */
  keyWindowId: string | undefined;
  /** The id of the key window when it is in full screen: the time to hide a menu bar and a Dock. */
  fullScreenWindowId: string | undefined;
  /** Bring a window to the front, make it key and move the keyboard focus into it. Takes a minimized window out of the Dock. */
  focus(id: string): void;
  /** Minimize a window; the next one becomes key. */
  minimize(id: string): void;
  /** Zoom a window to the space inside the insets, or back. */
  zoom(id: string): void;
  /** Enter or leave full screen. */
  toggleFullScreen(id: string): void;
  /** Close a window, as its close button does. */
  close(id: string): void;
  /** Make the next window key (Command-` on a Mac); `true` goes the other way. */
  cycle(backwards?: boolean): void;
}

// The surrounding manager's windows and commands, for a Dock or a Window menu.
export function useWindowManager(): WindowManagerApi {
  const store = useWindowManagerStore();
  const windows = useSyncExternalStore(store.subscribe, store.list, noWindows);
  return useMemo(() => {
    const key = windows.find((w) => w.state === "key");
    return {
      windows,
      keyWindowId: key?.id,
      fullScreenWindowId: key?.fullScreen ? key.id : undefined,
      ...store.commands,
    };
  }, [windows, store]);
}
