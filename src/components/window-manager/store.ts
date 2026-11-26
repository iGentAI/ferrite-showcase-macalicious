import type { WindowState } from "../window";

/** A window's position and size inside the manager, in points from its top-left corner. */
export interface WindowFrame {
  /** Distance of the window's left edge from the manager's left edge. */
  x: number;
  /** Distance of the window's top edge from the manager's top edge. */
  y: number;
  /** Frame width. */
  width: number;
  /** Frame height. */
  height: number;
}

/** Space at the manager's edges that windows keep clear of: the menu bar, the Dock. */
export interface WindowManagerInsets {
  top?: number;
  right?: number;
  bottom?: number;
  left?: number;
}

/** What the manager knows about one window. A new object whenever any of it changes. */
export interface ManagedWindowInfo {
  /** The window's id, unique in its manager. */
  id: string;
  /** The application the window belongs to; a Dock groups windows by it. */
  app: string;
  /** The window's name in a Dock, a Window menu or Mission Control. */
  title: string;
  /** Key (the one window that takes keyboard input), main or inactive. */
  state: WindowState;
  /** Hidden in the Dock. */
  minimized: boolean;
  /**
   * On a desktop that is not showing, as on another Space: not shown and never key. `focus(id)`,
   * `zoom(id)` and `toggleFullScreen(id)` bring it back. Set with `patch`.
   */
  away: boolean;
  /** Filling the manager, inside its insets. */
  zoomed: boolean;
  /** Covering the whole manager, without a frame. */
  fullScreen: boolean;
  /** A utility panel: floats above ordinary windows and leaves the front one main. */
  panel: boolean;
  /** Whether the window can be resized, zoomed and shown in full screen. */
  resizable: boolean;
  /** The narrowest the window can be made. */
  minWidth: number;
  /** The shortest the window can be made. */
  minHeight: number;
  /**
   * Stacking position, 1 for the window furthest back; also the window's `z-index`. Ordinary
   * windows are 1 to 399 and panels 401 to 799, below a menu bar and a Dock at 900. A
   * full-screen window is above 1000 while it is key, and takes its ordinary place when
   * another window is brought in front of it.
   */
  z: number;
  /** Where the window is when it is neither zoomed nor full screen. */
  frame: WindowFrame;
}

type Derived = "state" | "z";
type Flags = "minimized" | "away" | "zoomed" | "fullScreen";

/**
 * The state behind one `WindowManager`, for code that builds its own kind of managed window.
 * `ManagedWindow` is written with it; an application uses `useWindowManager()` instead.
 */
export interface WindowManagerStore {
  /** The manager's insets as last committed, with every edge filled in. */
  insets: Required<WindowManagerInsets>;
  /**
   * The frame moved, if need be, to where its title bar is within reach on a desktop of the
   * given size: below the top inset and above the bottom one, with 40 points of the window
   * between the left and right insets. A frame that is within reach is returned as it is,
   * the same object.
   */
  bound(this: void, frame: WindowFrame, desktopWidth: number, desktopHeight: number): WindowFrame;
  /** Hear every change; the returned function stops it. */
  subscribe(this: void, listener: () => void): () => void;
  /** Every window, in the order they were last made key: the key window is last. */
  list(this: void): readonly ManagedWindowInfo[];
  /** One window's record, the same object until that window changes. */
  get(this: void, id: string): ManagedWindowInfo | undefined;
  /** Register a window, in front. `close` is what its close button and `close(id)` call. */
  add(
    this: void,
    window: Omit<ManagedWindowInfo, Derived | Flags | "frame"> & { frame: Partial<WindowFrame> },
    close: () => void,
  ): void;
  /**
   * Forget a window. With `refocus` (the keyboard focus was inside it) the window that is key
   * afterwards is asked to take the focus, as it is after `close(id)`.
   */
  remove(this: void, id: string, refocus?: boolean): void;
  /** Change a window's record; `raise` also brings it to the front. */
  patch(
    this: void,
    id: string,
    change: Partial<Omit<ManagedWindowInfo, "id" | Derived>>,
    raise?: boolean,
  ): void;
  /** Make a window key because the pointer or the focus went into it. */
  raise(this: void, id: string): void;
  /** Make a window key by command: it is also asked to take the keyboard focus. Nothing happens for an id that is not registered. */
  focus(this: void, id: string): void;
  /**
   * Make no window key, as a press on the desktop does on a Mac: the windows stay where they are,
   * inactive, until a window is raised, opened or cycled to.
   */
  rest(this: void): void;
  /**
   * The number of the latest request to take the keyboard focus, when it was made of this
   * window, and 0 otherwise. A command (`focus`, `minimize`, `zoom`, `toggleFullScreen`,
   * `close`, `cycle`) makes one of whichever window is key when it is done; a window acts on
   * each number once.
   */
  focusRequest(this: void, id: string): number;
  minimize(this: void, id: string): void;
  zoom(this: void, id: string): void;
  toggleFullScreen(this: void, id: string): void;
  close(this: void, id: string): void;
  cycle(this: void, backwards?: boolean): void;
  /** The six commands above, as `useWindowManager()` hands them out: one object for the store's life. */
  commands: Pick<
    WindowManagerStore,
    "focus" | "minimize" | "zoom" | "toggleFullScreen" | "close" | "cycle"
  >;
}

const NONE: readonly ManagedWindowInfo[] = [];

// What a manager shows before any window has registered, and on the server.
export const noWindows = () => NONE;

// Records are immutable and keep their identity while nothing about them changes, so a window
// re-renders only when its own record does, and a change that alters nothing notifies no one.
export function createWindowManagerStore(): WindowManagerStore {
  let windows = NONE;
  let keyId: string | undefined;
  let resting = false;
  // The latest request to take the keyboard focus, and the window asked to close itself.
  let asked: string | undefined;
  let requests = 0;
  let closing: string | undefined;
  const listeners = new Set<() => void>();
  const closers = new Map<string, () => void>();

  const emit = () => {
    for (const listener of listeners) listener();
  };

  // Ask the key window to take the keyboard focus. Heard also when no record changed, so a
  // command can move the focus into a window that was key already. A close that the window's
  // owner did not carry out is forgotten here, with the next command.
  const ask = () => {
    asked = keyId;
    closing = undefined;
    requests++;
    emit();
  };

  const showing = (list: readonly ManagedWindowInfo[]) =>
    list.filter((w) => !w.minimized && !w.away);

  // Derive each window's state and stacking position from the order, then publish.
  const commit = (next: ManagedWindowInfo[]) => {
    const shown = showing(next);
    const key = resting ? undefined : shown.at(-1);
    const main = key?.panel ? shown.findLast((w) => !w.panel) : undefined;
    let changed = next.length !== windows.length;
    keyId = key?.id;
    const settled = next.map((w, i) => {
      const state: WindowState = w === key ? "key" : w === main ? "main" : "inactive";
      // Order of last use, with every panel above every ordinary window. Full screen covers
      // the menu bar and the Dock only while its window is key: a window brought in front of
      // it is never left underneath.
      // Each layer is a bounded range, so that no number of windows reaches the
      // menu bar and the Dock at 900, nor a panel a key full-screen window: beyond 399
      // windows the ones furthest back share the lowest place.
      const rank = Math.max(1, i + 400 - Math.max(399, next.length));
      const z = rank + (w.panel ? 400 : 0) + (w.fullScreen && w === key ? 1000 : 0);
      const out = w.state === state && w.z === z ? w : { ...w, state, z };
      if (out !== windows[i]) changed = true;
      return out;
    });
    if (!changed) return;
    windows = settled;
    emit();
  };

  const get = (id: string) => windows.find((w) => w.id === id);

  const patch: WindowManagerStore["patch"] = (id, change, raise = false) => {
    const index = windows.findIndex((w) => w.id === id);
    const current = windows[index];
    if (!current) return;
    if (raise) resting = false;
    const differs = (Object.keys(change) as (keyof typeof change)[]).some(
      (k) => change[k] !== current[k],
    );
    const next = windows.filter((w) => w !== current);
    next.splice(raise ? next.length : index, 0, differs ? { ...current, ...change } : current);
    commit(next);
  };

  // A window that cannot be resized neither zooms nor goes full screen, and a full-screen
  // window does not zoom. Leaving either state is always possible.
  const toggle = (id: string, flag: "zoomed" | "fullScreen") => {
    const current = get(id);
    if (
      current &&
      (current[flag] || (current.resizable && (flag === "fullScreen" || !current.fullScreen)))
    ) {
      patch(id, { [flag]: !current[flag], minimized: false, away: false }, true);
      ask();
    }
  };

  const commands: WindowManagerStore["commands"] = {
    focus(id) {
      if (!get(id)) return;
      patch(id, { minimized: false, away: false }, true);
      ask();
    },
    minimize(id) {
      // A full-screen window has no minimize button in Catalina either.
      if (get(id)?.fullScreen !== false) return;
      patch(id, { minimized: true });
      ask();
    },
    zoom: (id) => toggle(id, "zoomed"),
    toggleFullScreen: (id) => toggle(id, "fullScreen"),
    close(id) {
      closing = id;
      closers.get(id)?.();
    },
    cycle(backwards = false) {
      if (resting) {
        resting = false;
        commit([...windows]);
      }
      const shown = showing(windows);
      const key = shown.at(-1);
      const back = shown[0];
      if (!key || !back) return;
      // Forwards brings the window furthest back to the front; backwards sends the key one back.
      // A window alone stays where it is, and is still asked to take the focus.
      if (key !== back) {
        if (backwards) commit([key, ...windows.filter((w) => w !== key)]);
        else store.raise(back.id);
      }
      ask();
    },
  };

  const store: WindowManagerStore = {
    insets: { top: 0, right: 0, bottom: 0, left: 0 },
    subscribe(listener) {
      listeners.add(listener);
      return () => void listeners.delete(listener);
    },
    list: () => windows,
    get,
    bound(frame, w, h) {
      const { top, right, bottom, left } = store.insets;
      const x = Math.max(left + 40 - frame.width, Math.min(frame.x, w - right - 40));
      const y = Math.max(top, Math.min(frame.y, h - bottom - 22));
      return x === frame.x && y === frame.y ? frame : { ...frame, x, y };
    },
    focusRequest: (id) => (asked === id ? requests : 0),
    add(window, close) {
      closers.set(window.id, close);
      if (!get(window.id)) resting = false;
      // A window without a position is cascaded down and to the right of the ones before it.
      const step = 40 + (windows.length % 8) * 24;
      const { x = step, y = step + store.insets.top, width = 480, height = 320 } = window.frame;
      commit([
        ...windows.filter((w) => w.id !== window.id),
        {
          ...window,
          frame: { x, y, width, height },
          state: "inactive",
          minimized: false,
          away: false,
          zoomed: false,
          fullScreen: false,
          z: 0,
        },
      ]);
    },
    remove(id, refocus) {
      closers.delete(id);
      // A request made of this window dies with it: a later window of the same id is not asked.
      if (asked === id) asked = undefined;
      commit(windows.filter((w) => w.id !== id));
      // Closed by command, or with the keyboard focus inside: the window that is key now
      // takes the focus.
      if (refocus || closing === id) ask();
    },
    patch,
    raise: (id) => patch(id, { minimized: false }, true),
    rest() {
      resting = true;
      commit([...windows]);
    },
    ...commands,
    commands,
  };
  return store;
}
