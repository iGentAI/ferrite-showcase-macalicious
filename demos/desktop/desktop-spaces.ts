import type {
  ManagedWindowInfo,
  WindowFrame,
  WindowManagerStore,
} from "macalicious/window-manager";
import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  useSyncExternalStore,
} from "react";
import { readFile } from "./desktop-files";
import {
  type DesktopPictureDetail,
  desktopPictureGeneration,
  lastDesktopPicture,
  pictureFileOf,
  savedPictureCount,
  showDesktopPicture,
  subscribeDesktopPicture,
  useDesktopSetting,
  useDesktopValue,
} from "./desktop-personal";

/**
 * Spaces: desktops of their own for the windows, one showing at a time. Each window belongs to one
 * Space and the rest of the page is shared, as on a Mac: the icons, the Dock and the menu bar stay.
 * Kept with the person's settings.
 */

export const DESKTOP_SPACES = "desktop.spaces";
/** As many as Mission Control takes on a Mac. */
export const MOST_SPACES = 16;

export interface DesktopSpaces {
  /** The Spaces in the bar's order. A Space is named by where it stands: "Desktop 2". */
  spaces: readonly string[];
  /** The Space showing. */
  current: string;
  /** Which Space each window is on, by the window's id. */
  windows: Readonly<Record<string, string>>;
  /** What the next Space's id counts from: an id is never used twice. */
  next: number;
  /** Dock > Options > Assign To, by application: a Space, or `ALL_DESKTOPS`. */
  assigned?: Readonly<Record<string, string>>;
  /** What each Split View has and had: its division, and where its windows stood before. */
  tiles?: Readonly<Record<string, SplitTiles>>;
}

export interface SplitTiles {
  /** The left window's share of the width. */
  share: number;
  /** Where each window goes back to when the Split View ends. */
  frames: Readonly<Record<string, WindowFrame>>;
}

export const ALL_DESKTOPS = "all";

/** What Assign To shows for an application: `other` is a Desktop not showing now. */
export type SpaceAssignment = "all" | "this" | "none" | "other";

export const ONE_SPACE: DesktopSpaces = Object.freeze({
  spaces: Object.freeze(["1"]),
  current: "1",
  windows: Object.freeze({}),
  next: 2,
});

/** The Spaces in a stored value: the value itself, so that a read of it stays the same object. */
export const readSpaces = (stored: unknown): DesktopSpaces | undefined => {
  if (!stored || typeof stored !== "object") return undefined;
  const { spaces, current, windows, next } = stored as Partial<DesktopSpaces>;
  return Array.isArray(spaces) &&
    spaces.length > 0 &&
    spaces.every((each) => typeof each === "string") &&
    new Set(spaces).size === spaces.length &&
    typeof current === "string" &&
    spaces.includes(current) &&
    typeof next === "number" &&
    // The next Space's id must be one no Space has.
    Number.isSafeInteger(next) &&
    next > 0 &&
    !spaces.includes(String(next)) &&
    windows &&
    typeof windows === "object" &&
    !Array.isArray(windows) &&
    Object.values(windows).every((each) => spaces.includes(each))
    ? (stored as DesktopSpaces)
    : undefined;
};

export const spaceOfWindow = (state: DesktopSpaces, id: string) =>
  state.windows[id] ?? state.current;

const onAllDesktops = (state: DesktopSpaces, app: string | undefined) =>
  app !== undefined && state.assigned?.[app] === ALL_DESKTOPS;

/** Whether a window belongs on the Space showing. A full-screen Space or Split View holds its own windows alone. */
export const showsNow = (state: DesktopSpaces, id: string, app: string | undefined) => {
  const on = spaceOfWindow(state, id);
  if (!isDesktopSpace(on) || !isDesktopSpace(state.current)) {
    return on === state.current;
  }
  return onAllDesktops(state, app) || on === state.current;
};

export function assignmentOf(state: DesktopSpaces, app: string): SpaceAssignment {
  const to = state.assigned?.[app];
  if (to === undefined) return "none";
  if (to === ALL_DESKTOPS) return "all";
  return to === state.current ? "this" : "other";
}

/** The Space showing, or the nearest Desktop when that is a full-screen Space. */
const desktopBeside = (state: DesktopSpaces) => {
  const at = state.spaces.indexOf(state.current);
  return isDesktopSpace(state.current)
    ? state.current
    : (state.spaces.slice(0, at).findLast(isDesktopSpace) ??
        state.spaces.slice(at + 1).find(isDesktopSpace) ??
        state.current);
};

/** Assign To: `this` also brings the application's open windows to the Space showing. */
export function assignApp(
  state: DesktopSpaces,
  app: string,
  windows: readonly string[],
  choice: Exclude<SpaceAssignment, "other">,
): DesktopSpaces {
  const { [app]: _was, ...assigned } = state.assigned ?? {};
  if (choice === "none") return { ...state, assigned };
  if (choice === "all") return { ...state, assigned: { ...assigned, [app]: ALL_DESKTOPS } };
  const here = desktopBeside(state);
  return {
    ...state,
    assigned: { ...assigned, [app]: here },
    // A window in full screen keeps its own Space until it leaves.
    windows: {
      ...state.windows,
      ...Object.fromEntries(
        windows.filter((id) => isDesktopSpace(spaceOfWindow(state, id))).map((id) => [id, here]),
      ),
    },
  };
}

export function addSpace(state: DesktopSpaces): DesktopSpaces {
  if (state.spaces.length >= MOST_SPACES) return state;
  return { ...state, spaces: [...state.spaces, String(state.next)], next: state.next + 1 };
}

/** Takes a Space out: its windows go to the one before it, and the one showing moves there too. */
export function removeSpace(state: DesktopSpaces, space: string): DesktopSpaces {
  const at = state.spaces.indexOf(space);
  // The nearest Desktop before it, else after it: the last Desktop stays.
  const heir =
    state.spaces.slice(0, Math.max(at, 0)).findLast(isDesktopSpace) ??
    state.spaces.slice(at + 1).find(isDesktopSpace);
  if (at < 0 || heir === undefined) return state;
  return {
    ...state,
    spaces: state.spaces.filter((each) => each !== space),
    current: state.current === space ? heir : state.current,
    assigned: Object.fromEntries(
      Object.entries(state.assigned ?? {}).filter(([, to]) => to !== space),
    ),
    windows: Object.fromEntries(
      Object.entries(state.windows).map(([id, on]) => [id, on === space ? heir : on]),
    ),
  };
}

/** Moves a Space to stand at `to` in the bar. */
export function moveSpace(state: DesktopSpaces, space: string, to: number): DesktopSpaces {
  const rest = state.spaces.filter((each) => each !== space);
  if (rest.length === state.spaces.length || state.spaces[to] === space) return state;
  return { ...state, spaces: [...rest.slice(0, to), space, ...rest.slice(to)] };
}

/** The next Space along, stopping at the ends as a Mac's does. */
export function spaceBeside(state: DesktopSpaces, step: -1 | 1): string {
  const at = state.spaces.indexOf(state.current);
  return state.spaces[at + step] ?? state.current;
}

const FULL_SCREEN = "fs:";
const SPLIT = "split:";

/** The window a Space is the full screen of, if it is one. */
export const fullScreenWindowOf = (space: string) =>
  space.startsWith(FULL_SCREEN) ? space.slice(FULL_SCREEN.length) : undefined;

/** The left and right windows of a Split View's Space, if it is one. */
export const splitWindowsOf = (space: string): readonly [string, string] | undefined => {
  if (!space.startsWith(SPLIT)) return undefined;
  const [left, right] = space.slice(SPLIT.length).split("|");
  return left && right ? [left, right] : undefined;
};

/** Whether a Space is a Desktop, not a Space made for its windows. */
export const isDesktopSpace = (space: string) =>
  !space.startsWith(FULL_SCREEN) && !space.startsWith(SPLIT);

/** How wide the black divider of a Split View is, in points. */
export const SPLIT_DIVIDER = 6;

/** The shares a divider stops at, as on a Mac where a window will not go narrower. */
const LEAST_SHARE = 0.25;

export const boundShare = (share: number) =>
  Number.isFinite(share) ? Math.min(1 - LEAST_SHARE, Math.max(LEAST_SHARE, share)) : 0.5;

/** Where the two windows of a Split View stand on a screen of this size: left, then right. */
export function splitFrames(
  share: number,
  width: number,
  height: number,
): readonly [WindowFrame, WindowFrame] {
  const left = Math.round((width - SPLIT_DIVIDER) * boundShare(share));
  return [
    { x: 0, y: 0, width: left, height },
    { x: left + SPLIT_DIVIDER, y: 0, width: width - left - SPLIT_DIVIDER, height },
  ];
}

/** Two windows on a Space of their own, beside the Space the left one was on, and shown. */
export function tileWindows(
  state: DesktopSpaces,
  left: string,
  right: string,
  frames: SplitTiles["frames"],
): DesktopSpaces {
  const space = `${SPLIT}${left}|${right}`;
  const at = state.spaces.indexOf(spaceOfWindow(state, left));
  return {
    ...state,
    spaces: [...state.spaces.slice(0, at + 1), space, ...state.spaces.slice(at + 1)],
    windows: { ...state.windows, [left]: space, [right]: space },
    current: space,
    tiles: { ...state.tiles, [space]: { share: 0.5, frames } },
  };
}

/** The two windows of a Split View change sides, each keeping its width. */
export function swapTiles(state: DesktopSpaces, space: string): DesktopSpaces {
  const pair = splitWindowsOf(space);
  const tile = state.tiles?.[space];
  if (!pair || !tile) return state;
  const swapped = `${SPLIT}${pair[1]}|${pair[0]}`;
  const { [space]: _gone, ...tiles } = state.tiles ?? {};
  return {
    ...state,
    spaces: state.spaces.map((each) => (each === space ? swapped : each)),
    windows: { ...state.windows, [pair[0]]: swapped, [pair[1]]: swapped },
    current: state.current === space ? swapped : state.current,
    tiles: { ...tiles, [swapped]: { ...tile, share: boundShare(1 - tile.share) } },
  };
}

type SeenWindow = Pick<ManagedWindowInfo, "id" | "state" | "away"> & {
  app?: string;
  fullScreen?: boolean;
  panel?: boolean;
  minimized?: boolean;
};

/**
 * A window in full screen is a Space of its own, beside the Space it came from, and that Space goes
 * when it leaves full screen or closes, its window going back to the Space before. With `coming`, a
 * window not open or not yet in full screen is one still coming back with the page, and its Space
 * waits for it.
 */
function withFullScreen(
  state: DesktopSpaces,
  windows: readonly SeenWindow[],
  coming: boolean,
): DesktopSpaces {
  let next = state;
  for (const { id, app, fullScreen, state: role } of windows) {
    const own = `${FULL_SCREEN}${id}`;
    if (!fullScreen || next.windows[id] === own) continue;
    const at = next.spaces.indexOf(spaceOfWindow(next, id));
    const spaces = next.spaces.includes(own)
      ? next.spaces
      : [...next.spaces.slice(0, at + 1), own, ...next.spaces.slice(at + 1)];
    // The application's panels go with it, and come back with it through `removeSpace`.
    const panels = windows.filter((each) => each.panel && app !== undefined && each.app === app);
    next = {
      ...next,
      spaces,
      windows: {
        ...next.windows,
        [id]: own,
        ...Object.fromEntries(panels.map((each) => [each.id, own])),
      },
      current: role === "key" ? own : next.current,
    };
  }
  for (const space of next.spaces) {
    const id = fullScreenWindowOf(space);
    if (id !== undefined && !coming && !windows.some((each) => each.id === id && each.fullScreen)) {
      next = removeSpace(next, space);
    }
    // A Split View ends as either window leaves it, by closing, minimizing or going to full screen.
    const pair = splitWindowsOf(space);
    if (
      pair &&
      !pair.every((each) => {
        const window = windows.find(({ id }) => id === each);
        return next.windows[each] === space && (window ? !window.minimized : coming);
      })
    ) {
      next = removeSpace(next, space);
    }
  }
  return next;
}

/**
 * What `windows`, as the manager has them now, make of the Spaces: a window first seen goes on the
 * Space showing unless it has one, one that closed is forgotten, and a window a command brought back
 * from another Space takes the person there. Answers `state` itself when nothing changed.
 */
export function settled(
  before: DesktopSpaces,
  windows: readonly SeenWindow[],
  seen: ReadonlySet<string>,
  coming = false,
): DesktopSpaces {
  const state = withFullScreen(before, windows, coming);
  const open = new Set(windows.map(({ id }) => id));
  const forgotten = [...seen].filter((id) => !open.has(id) && state.windows[id] !== undefined);
  const fresh = windows.filter(({ id }) => !seen.has(id) && state.windows[id] === undefined);
  const brought = windows.find(
    ({ id, app, state: role, away }) =>
      seen.has(id) && role === "key" && !away && !showsNow(state, id, app),
  );
  if (forgotten.length === 0 && fresh.length === 0 && !brought) return state;
  // A window opened for a Desktop of its application's goes there, and the person with it.
  const homeOf = (app: string | undefined) => {
    // A further window of the application in full screen stays with it, as its panels do.
    const inFullScreen = fullScreenWindowOf(state.current);
    const ownApp = windows.find(({ id }) => id === inFullScreen)?.app;
    if (ownApp !== undefined && app === ownApp) return state.current;
    const to = app === undefined ? undefined : state.assigned?.[app];
    if (to !== undefined && state.spaces.includes(to)) return to;
    if (isDesktopSpace(state.current)) return state.current;
    // Any other opened from a full-screen Space goes on the Desktop beside it.
    return desktopBeside(state);
  };
  const opened = fresh.find(({ state: role }) => role === "key");
  const current = brought
    ? spaceOfWindow(state, brought.id)
    : opened
      ? homeOf(opened.app)
      : state.current;
  const kept = Object.entries(state.windows).filter(([id]) => !forgotten.includes(id));
  return {
    ...state,
    current,
    windows: Object.fromEntries([...kept, ...fresh.map(({ id, app }) => [id, homeOf(app)])]),
  };
}

const isTyping = (target: EventTarget | null) =>
  target instanceof Element &&
  Boolean(
    target.closest(
      'input, textarea, select, [contenteditable]:not([contenteditable="false"]), [role="textbox"]',
    ),
  );

export type SpaceKey = { step: -1 | 1 } | { position: number };

const readShortcut = (stored: unknown) => (typeof stored === "string" ? stored : undefined);

/**
 * The shortcuts chosen in System Preferences > Mission Control, or the ones it starts with. F3 always
 * opens Mission Control, so it can be no other's.
 */
export function useWindowShortcuts() {
  const notF3 = (shortcut: string) => (shortcut === "F3" ? "–" : shortcut);
  return {
    missionControl: useDesktopValue("mission-control.missionControl", readShortcut, "⌃↑"),
    applicationWindows: notF3(
      useDesktopValue("mission-control.applicationWindows", readShortcut, "⌃↓"),
    ),
    showDesktop: notF3(useDesktopValue("mission-control.showDesktop", readShortcut, "F11")),
    missionControlMouse: useDesktopValue("mission-control.missionControlMouse", readShortcut, "–"),
    applicationWindowsMouse: useDesktopValue(
      "mission-control.applicationWindowsMouse",
      readShortcut,
      "–",
    ),
    showDesktopMouse: useDesktopValue("mission-control.showDesktopMouse", readShortcut, "–"),
  };
}

/**
 * Whether a key is what the pane's menu calls `shortcut`: an arrow or a function key after the
 * modifiers held when it was chosen (⌃ ⌥ ⇧ ⌘), or – for none. ⌘ is Control where the desktop is not
 * on a Mac. Plain F11 counts only on a Mac: elsewhere a browser keeps it for its own full screen.
 */
export function matchesShortcut(shortcut: string, event: KeyboardEvent): boolean {
  const onMac = /Mac/.test(navigator.platform);
  const parts = /^([⌃⌥⇧⌘]*)(↑|↓|F\d+)$/.exec(shortcut);
  if (!parts) return false;
  const [, held = "", key = ""] = parts;
  if (shortcut === "F11" && !onMac) return false;
  const command = held.includes("⌘");
  if (event.ctrlKey !== (held.includes("⌃") || (command && !onMac))) return false;
  if (event.metaKey !== (command && onMac)) return false;
  if (event.altKey !== held.includes("⌥") || event.shiftKey !== held.includes("⇧")) return false;
  return event.key === (key === "↑" ? "ArrowUp" : key === "↓" ? "ArrowDown" : key);
}

/** The mouse's buttons the pane offers, by `MouseEvent.button`; 0 and 2 are the primary and secondary. */
export const MOUSE_BUTTONS: Readonly<Record<number, string>> = {
  1: "Mouse Button 3",
  3: "Mouse Button 4",
  4: "Mouse Button 5",
};

/**
 * What a key asks of the Spaces. Control-Left and Control-Right where a page gets them, and with Shift
 * where the system keeps them; neither while the person is typing, where they move the caret. Off a
 * Mac, an application in front may claim the plain ones first (`desktop.tsx`).
 * Control-1 to 9 on a Mac, since Control is Command elsewhere, and Control-Option-1 to 9 everywhere.
 */
export function spaceKey(event: KeyboardEvent, onMac: boolean): SpaceKey | null {
  if (!event.ctrlKey || event.metaKey) return null;
  if ((event.key === "ArrowLeft" || event.key === "ArrowRight") && !event.altKey) {
    return isTyping(event.target) ? null : { step: event.key === "ArrowLeft" ? -1 : 1 };
  }
  const digit = /^Digit([1-9])$/.exec(event.code)?.[1];
  if (digit && !event.shiftKey && (event.altKey || onMac)) return { position: Number(digit) - 1 };
  return null;
}

export interface SpacesApi {
  state: DesktopSpaces;
  /** Shows a Space, with its front window key; on an empty one no window is. */
  show: (space: string) => void;
  add: () => void;
  remove: (space: string) => void;
  move: (space: string, to: number) => void;
  /** Puts a window on a Space. */
  assign: (window: string, space: string) => void;
  /** Puts a window on a Space made for it. */
  assignToNew: (window: string) => void;
  /** Takes the window of a full-screen Space out of full screen, or ends a Split View. */
  leaveFullScreen: (space: string) => void;
  /** Tiles two windows in a Split View of their own. */
  tile: (left: string, right: string, frames: SplitTiles["frames"]) => void;
  /** The two windows of a Split View change sides. */
  swap: (space: string) => void;
  /** A window let go on a full-screen Space: that window and this one share a Split View instead. */
  tileOnFullScreen: (window: string, space: string, side: "left" | "right") => void;
  /** Moves a Split View's divider. */
  setShare: (space: string, share: number) => void;
  /** These windows of a Split View that has ended have gone back to where they stood. */
  forgetTiles: (space: string, windows: readonly string[]) => void;
  /** Dock > Options > Assign To. */
  assignApp: (app: string, choice: Exclude<SpaceAssignment, "other">) => void;
  /** Carries out what `spaceKey` answered. */
  press: (key: SpaceKey) => void;
}

/** The picture each Space shows, by Space: not `DesktopSpaces`, whose setting it would outgrow. */
export const DESKTOP_SPACE_PICTURES = "desktop.spacePictures";

type SpacePicture = Pick<DesktopPictureDetail, "day" | "night" | "look" | "file">;

const readSpacePictures = (stored: unknown): Readonly<Record<string, SpacePicture>> | undefined =>
  stored && typeof stored === "object" && !Array.isArray(stored)
    ? (stored as Record<string, SpacePicture>)
    : undefined;

const NO_PICTURES: Readonly<Record<string, SpacePicture>> = Object.freeze({});

/** A picture of the drive is kept by its file: the address the page read it to is the page's alone. */
const pictureOf = (detail: DesktopPictureDetail | null): SpacePicture => {
  const file = detail?.file ?? (detail?.day === undefined ? undefined : pictureFileOf(detail.day));
  return file === undefined
    ? {
        ...(detail?.day === undefined ? {} : { day: detail.day }),
        ...(detail?.night === undefined ? {} : { night: detail.night }),
        ...(detail?.look === undefined ? {} : { look: detail.look }),
      }
    : { file, ...(detail?.look === undefined ? {} : { look: detail.look }) };
};

const samePicture = (a: SpacePicture | undefined, b: SpacePicture) =>
  a !== undefined &&
  a.day === b.day &&
  a.night === b.night &&
  a.look === b.look &&
  a.file === b.file;

/** A picture made on this page and in no file (one of Photos' while it is saved) ends with the page. */
const lastsOnlyHere = ({ day, night }: SpacePicture) =>
  [day, night].some((url) => url?.startsWith("blob:") || url?.startsWith("data:"));

/**
 * Each Space keeps its own desktop picture: one chosen is the Space's, and showing a Space shows its
 * picture. A Space never given one goes on showing what was showing. Answers what the bar draws.
 */
export function useSpacePictures(
  current: string,
  spaces: readonly string[],
  loaded: boolean,
): (space: string) => string | undefined {
  const [kept, setKept] = useDesktopSetting(DESKTOP_SPACE_PICTURES, readSpacePictures, NO_PICTURES);
  const detail = useSyncExternalStore(subscribeDesktopPicture, lastDesktopPicture, () => null);
  const here = useRef(new Map<string, SpacePicture>());
  const was = useRef<string | null>(null);
  // The detail the last change of Space found: chosen before it, so not the choice of this Space.
  const left = useRef<DesktopPictureDetail | null>(null);
  // What each Space's file was read to, by file.
  const urls = useRef(new Map<string, string>());
  const [, redraw] = useState(0);
  const known = (space: string) => here.current.get(space) ?? kept[space];
  const shownAs = (picture: SpacePicture): DesktopPictureDetail | undefined => {
    if (picture.file === undefined) return picture;
    const url = urls.current.get(picture.file);
    return url === undefined ? undefined : { ...picture, day: url, night: url };
  };
  const show = (picture: SpacePicture) => {
    const shown = shownAs(picture);
    if (shown) showDesktopPicture({ ...shown, restored: true });
  };
  const note = (...notes: readonly (readonly [string, SpacePicture])[]) => {
    const lasting = notes.filter(([space, picture]) => {
      if (lastsOnlyHere(picture)) here.current.set(space, picture);
      else here.current.delete(space);
      return !lastsOnlyHere(picture) && !samePicture(kept[space], picture);
    });
    if (lasting.length === 0) return;
    const named = new Set(lasting.map(([space]) => space));
    const others = Object.entries(kept).filter(([id]) => !named.has(id) && spaces.includes(id));
    setKept(Object.fromEntries([...others, ...lasting]));
  };

  // Nothing of one person's pictures stays for the next, from the render that finds the session over.
  const session = useSyncExternalStore(subscribeDesktopPicture, desktopPictureGeneration, () => 0);
  const sessionHeld = useRef(session);
  if (sessionHeld.current !== session) {
    sessionHeld.current = session;
    for (const url of urls.current.values()) URL.revokeObjectURL(url);
    urls.current.clear();
    here.current.clear();
    was.current = null;
    left.current = null;
  }
  useEffect(() => {
    const read = urls.current;
    return () => {
      for (const url of read.values()) URL.revokeObjectURL(url);
      read.clear();
    };
  }, []);

  // A photo is saved to the drive some time after it was chosen, perhaps with another Space showing:
  // what a Space held of it is then its file.
  useSyncExternalStore(subscribeDesktopPicture, savedPictureCount, () => 0);

  const files = [...new Set(spaces.flatMap((space) => kept[space]?.file ?? []))].join("\n");
  // An address is given back once no Space holds its file and the desktop is not showing it.
  useEffect(() => {
    const wanted = files.split("\n");
    for (const [file, url] of urls.current) {
      if (wanted.includes(file) || url === detail?.day) continue;
      URL.revokeObjectURL(url);
      urls.current.delete(file);
    }
  }, [files, detail]);
  // biome-ignore lint/correctness/useExhaustiveDependencies: a new session has its files read again.
  useEffect(() => {
    if (!loaded) return;
    const wanted = files.split("\n").filter(Boolean);
    const reading = new AbortController();
    for (const file of wanted) {
      if (urls.current.has(file)) continue;
      // A file gone from the drive leaves its Space showing what was showing.
      void readFile(file, { signal: reading.signal })
        .then((blob) => {
          if (reading.signal.aborted || !blob.type.startsWith("image/")) return;
          urls.current.set(file, URL.createObjectURL(blob));
          redraw((count) => count + 1);
        })
        .catch(() => undefined);
    }
    return () => reading.abort();
  }, [files, loaded, session]);

  useEffect(() => {
    if (!loaded) return;
    const saved = [...here.current].flatMap(([space, { day, look }]) => {
      const file = day === undefined ? undefined : pictureFileOf(day);
      return file === undefined ? [] : [[space, { file, ...(look && { look }) }] as const];
    });
    if (saved.length > 0) {
      // Alone: the change it makes is what the next run reads.
      note(...saved);
      return;
    }
    const from = was.current;
    was.current = current;
    const wanted = known(current);
    if (from !== null && from !== current) {
      // A Space never given a picture has the one it was left showing, or now goes on showing it.
      const showing = pictureOf(detail);
      left.current = detail;
      note(
        ...(known(from) ? [] : [[from, showing] as const]),
        ...(wanted ? [] : [[current, showing] as const]),
      );
      if (wanted) show(wanted);
    } else if (detail && !detail.restored && detail !== left.current) {
      note([current, pictureOf(detail)]);
    } else if (wanted && !samePicture(wanted, pictureOf(detail))) {
      // What the desktop brought back at start is the choice made last, perhaps on another Space.
      show(wanted);
    }
  });
  return (space) => {
    const picture = known(space);
    return picture && shownAs(picture)?.day;
  };
}

/** How long the windows take to slide from one Space to the next, in milliseconds. */
const SLIDE_MS = 300;

/** The windows of the Space left slide off and those of the one shown slide in, as on a Mac. */
function slideBetween(
  root: Element | null | undefined,
  state: DesktopSpaces,
  from: string,
  stays: ReadonlySet<string>,
) {
  if (!root || root.hasAttribute("data-mission-control-open")) return;
  if (matchMedia?.("(prefers-reduced-motion: reduce)").matches) return;
  const step = state.spaces.indexOf(state.current) - state.spaces.indexOf(from);
  if (state.spaces.indexOf(from) < 0 || step === 0) return;
  const width = step > 0 ? root.clientWidth : -root.clientWidth;
  for (const shell of root.querySelectorAll<HTMLElement>("[data-window-id]")) {
    const id = shell.dataset.windowId ?? "";
    if (shell.hasAttribute("data-minimized") || stays.has(id)) continue;
    const on = state.windows[id];
    if (on === state.current) {
      shell.animate?.([{ translate: `${width}px 0` }, { translate: "0 0" }], {
        duration: SLIDE_MS,
        easing: "ease",
      });
    } else if (on === from) {
      // Held in sight while it goes: it is already away.
      shell.animate?.(
        [
          { translate: "0 0", visibility: "visible" },
          { translate: `${-width}px 0`, visibility: "visible" },
        ],
        { duration: SLIDE_MS, easing: "ease" },
      );
    }
  }
}

/** The Spaces of the desktop whose manager is `store`, once the person's settings have loaded. */
export function useDesktopSpaces(
  store: WindowManagerStore,
  windows: readonly ManagedWindowInfo[],
  loaded: boolean,
  root: () => Element | null | undefined,
  /** Whether windows are still coming back with the page. */
  coming: () => boolean = () => false,
): SpacesApi {
  const [state, setState] = useDesktopSetting(DESKTOP_SPACES, readSpaces, ONE_SPACE);
  const seen = useRef(new Set<string>());
  const wasShowing = useRef<string | null>(null);
  const shown = useCallback(
    (now: DesktopSpaces) => {
      for (const { id, app, away } of store.list()) {
        const wanted = !showsNow(now, id, app);
        if (away !== wanted) store.patch(id, { away: wanted });
      }
    },
    [store],
  );
  // Before paint, so that a window coming back on another Space does not flash on this one.
  useLayoutEffect(() => {
    if (!loaded) return;
    const next = settled(state, windows, seen.current, coming());
    seen.current = new Set(windows.map(({ id }) => id));
    if (next !== state) setState(next);
    shown(next);
    // A window that was in full screen when the page went is again.
    if (coming()) {
      for (const { id, fullScreen } of windows) {
        if (!fullScreen && next.windows[id] === `${FULL_SCREEN}${id}`) {
          store.patch(id, { fullScreen: true });
        }
      }
    }
    const from = wasShowing.current;
    wasShowing.current = next.current;
    if (from !== null && from !== next.current) {
      const stays = windows.filter(({ app }) => onAllDesktops(next, app)).map(({ id }) => id);
      slideBetween(root(), next, from, new Set(stays));
    }
  }, [loaded, state, windows, setState, shown, root, coming, store]);

  // Several changes in one render build on each other.
  const newest = useRef(state);
  newest.current = state;
  const change = (next: DesktopSpaces) => {
    if (next === newest.current) return;
    newest.current = next;
    setState(next);
    shown(next);
  };
  const show = (space: string) => {
    if (space === state.current) return;
    change({ ...state, current: space });
    const top = store
      .list()
      .findLast(
        ({ id, app, minimized }) => !minimized && showsNow({ ...state, current: space }, id, app),
      );
    if (top) store.focus(top.id);
  };
  return {
    state,
    show,
    add: () => change(addSpace(state)),
    remove: (space) => change(removeSpace(state, space)),
    move: (space, to) => change(moveSpace(state, space, to)),
    assign: (window, space) => {
      // A full-screen Space or Split View holds its own windows alone.
      if (isDesktopSpace(space)) {
        change({ ...state, windows: { ...state.windows, [window]: space } });
      }
    },
    leaveFullScreen: (space) => {
      const id = fullScreenWindowOf(space);
      if (id !== undefined) store.toggleFullScreen(id);
      else if (splitWindowsOf(space)) change(removeSpace(state, space));
    },
    tile: (left, right, frames) => change(tileWindows(state, left, right, frames)),
    swap: (space) => change(swapTiles(state, space)),
    tileOnFullScreen: (window, space, side) => {
      const full = fullScreenWindowOf(space);
      const dropped = store.get(window);
      const held = full === undefined ? undefined : store.get(full);
      if (full === undefined || !held || !dropped?.resizable || full === window) return;
      store.toggleFullScreen(full);
      const [left, right] = side === "left" ? [window, full] : [full, window];
      change(
        tileWindows(removeSpace(state, space), left, right, {
          [full]: held.frame,
          [window]: dropped.frame,
        }),
      );
    },
    setShare: (space, share) => {
      const tile = state.tiles?.[space];
      if (tile) change({ ...state, tiles: { ...state.tiles, [space]: { ...tile, share } } });
    },
    forgetTiles: (space, gone) => {
      const { [space]: tile, ...tiles } = newest.current.tiles ?? {};
      const frames = Object.entries(tile?.frames ?? {}).filter(([id]) => !gone.includes(id));
      change({
        ...newest.current,
        tiles:
          tile && frames.length > 0
            ? { ...tiles, [space]: { ...tile, frames: Object.fromEntries(frames) } }
            : tiles,
      });
    },
    assignApp: (app, choice) =>
      change(
        assignApp(
          state,
          app,
          store
            .list()
            .filter((each) => each.app === app)
            .map(({ id }) => id),
          choice,
        ),
      ),
    assignToNew: (window) => {
      const added = addSpace(state);
      const space = added.spaces.at(-1);
      if (added === state || space === undefined) return;
      change({ ...added, windows: { ...added.windows, [window]: space } });
    },
    press: (key) => {
      const space =
        "step" in key
          ? spaceBeside(state, key.step)
          : (state.spaces.filter(isDesktopSpace)[key.position] ?? state.current);
      show(space);
    },
  };
}
