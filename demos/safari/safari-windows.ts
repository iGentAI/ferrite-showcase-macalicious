import { requestDesktopEffects } from "../desktop/desktop-effects";

/** A tab as it goes from one window to another: where it has been and where it is. */
export interface TabSeed {
  history: readonly string[];
  index: number;
}

/** What a window of Safari is, to the others: Merge All Windows and the windows' kept tabs. */
export interface LiveSafariWindow {
  isPrivate: boolean;
  keepsTabs: boolean;
  seeds: () => readonly TabSeed[];
  adopt: (seeds: readonly TabSeed[]) => void;
  close: () => void;
}

/** The windows closed before the ones closing now that History can still reopen, newest kept. */
const MAX_OLDER_CLOSED = 10;

/** The windows closing in this commit, as Quit unmounts them: gone by the next microtask. */
let closingNow: readonly ClosedWindow[] = [];

interface ClosedWindow {
  window: LiveSafariWindow;
  seeds: readonly TabSeed[];
  kept: boolean;
}

const live = new Set<LiveSafariWindow>();
const merged = new WeakSet<LiveSafariWindow>();
let closed: readonly ClosedWindow[] = [];
/** The windows that went when Safari last closed its last window, the one keeping the tabs aside:
 * that one's tabs come back by themselves. */
let lastSession: readonly ClosedWindow[] = [];
let version = 0;
const listeners = new Set<() => void>();
const changed = () => {
  version += 1;
  for (const listener of listeners) listener();
};

/** A pinned tab, which shows in every window that is not private. */
export interface PinnedTab extends TabSeed {
  key: string;
}

let pins: readonly PinnedTab[] = [];
let pinCount = 0;

export const newPinKey = () => `pin-${++pinCount}`;

const sameSeed = (one: TabSeed, other: TabSeed) =>
  one.index === other.index &&
  one.history.length === other.history.length &&
  one.history.every((address, at) => address === other.history[at]);

/** A tab was unpinned: it stays where it is, and leaves the other windows. */
export function forgetPin(key: string): void {
  pins = pins.filter((pin) => pin.key !== key);
  changed();
}

/** What a window has to do to its tabs so that its pinned ones are every window's. */
export interface PinChanges {
  add: readonly PinnedTab[];
  remove: readonly string[];
  follow: readonly PinnedTab[];
}

/**
 * Brings a window's pinned tabs and every window's list together. `seen` is what the window last
 * knew of each pin: a tab that differs from it was pinned or moved on here, and the list takes it;
 * a pin that differs from it moved on in another window, and the tab follows.
 */
export function reconcilePins(local: readonly PinnedTab[], seen: Map<string, TabSeed>): PinChanges {
  let next = pins;
  const remove: string[] = [];
  const follow: PinnedTab[] = [];
  for (const tab of local) {
    const shared = next.find((pin) => pin.key === tab.key);
    const known = seen.get(tab.key);
    if (!shared) {
      if (known) {
        remove.push(tab.key);
        seen.delete(tab.key);
      } else {
        next = [...next, tab];
        seen.set(tab.key, tab);
      }
    } else if (known && !sameSeed(tab, known)) {
      next = next.map((pin) => (pin.key === tab.key ? tab : pin));
      seen.set(tab.key, tab);
    } else if (!sameSeed(tab, shared)) {
      follow.push(shared);
      seen.set(tab.key, shared);
    } else {
      seen.set(tab.key, tab);
    }
  }
  const add = next.filter((pin) => !local.some((tab) => tab.key === pin.key));
  for (const pin of add) seen.set(pin.key, pin);
  if (next !== pins) {
    pins = next;
    changed();
  }
  return { add, remove, follow };
}

/** What a window is asked to be when it opens: the desktop hands it over as the prop `opening`. */
export interface SafariOpening {
  isPrivate: boolean;
  seeds: readonly TabSeed[];
}

const isSeed = (value: unknown): value is TabSeed => {
  if (typeof value !== "object" || value === null) return false;
  const { history, index } = value as Partial<TabSeed>;
  return (
    Array.isArray(history) &&
    history.length > 0 &&
    history.every((entry) => typeof entry === "string") &&
    Number.isInteger(index) &&
    (index as number) >= 0 &&
    (index as number) < history.length
  );
};

/**
 * The `opening` a window was given, which comes through the desktop's effects as anything. Not an
 * opening at all, it is a plain window; a tab that makes no sense is left out; only `true` is
 * private.
 */
export function readSafariOpening(value: unknown): SafariOpening | null {
  if (typeof value !== "object" || value === null) return null;
  const { isPrivate, seeds } = value as { isPrivate?: unknown; seeds?: unknown };
  return {
    isPrivate: isPrivate === true,
    seeds: Array.isArray(seeds) ? seeds.filter(isSeed) : [],
  };
}

/** Have the desktop open another window of Safari, private or holding these tabs. */
export function openSafariWindow(next: { isPrivate?: boolean; seeds?: readonly TabSeed[] }): void {
  const opening: SafariOpening = { isPrivate: next.isPrivate ?? false, seeds: next.seeds ?? [] };
  requestDesktopEffects([{ newWindow: "safari", opening }]);
}

/** Whether a window already keeps the person's tabs on the server; only one does at a time. */
export const tabsHaveKeeper = () => [...live].some((window) => window.keepsTabs);

/**
 * Whether `window` keeps the tabs from now on: the keeper is whichever plain window asks first
 * once it is on the list, and when it goes, the oldest one left. Asked after registering, so two
 * windows mounted together cannot both become it.
 */
export function claimTabs(window: LiveSafariWindow): boolean {
  if (window.isPrivate || window.keepsTabs || tabsHaveKeeper()) return false;
  if ([...live].find((other) => !other.isPrivate) !== window) return false;
  window.keepsTabs = true;
  return true;
}

/** Keep a window on the list until it closes, when a window that is not private can be reopened. */
export function registerSafariWindow(window: LiveSafariWindow): () => void {
  live.add(window);
  // Registered again: it never closed (React runs an effect's cleanup and the effect once more when
  // it checks a component).
  closed = closed.filter((each) => each.window !== window);
  closingNow = closingNow.filter((each) => each.window !== window);
  lastSession = lastSession.filter((each) => each.window !== window);
  changed();
  return () => {
    live.delete(window);
    if (frontPage?.window === window) frontPage = null;
    if (!window.isPrivate && !merged.has(window)) {
      const entry = { window, seeds: window.seeds(), kept: window.keepsTabs };
      closed = [...closed, entry];
      if (closingNow.length === 0) {
        queueMicrotask(() => {
          closingNow = [];
        });
      }
      closingNow = [...closingNow, entry];
      closed = [
        ...closed.filter((each) => !closingNow.includes(each)).slice(-MAX_OLDER_CLOSED),
        ...closingNow,
      ];
    }
    if (live.size === 0) lastSession = closingNow.filter((each) => !each.kept);
    // The kept tabs hold the pins while no plain window is open: its first window reads them back.
    if ([...live].every((each) => each.isPrivate)) pins = [];
    changed();
  };
}

/** The other windows of the same kind: a private window's tabs stay among private windows. */
export const otherWindows = (window: LiveSafariWindow) =>
  [...live].filter((other) => other !== window && other.isPrivate === window.isPrivate);

/** Window > Merge All Windows: `into` takes the tabs of the others, which close. */
export function mergeWindows(into: LiveSafariWindow): void {
  for (const other of otherWindows(into)) {
    into.adopt(other.seeds());
    merged.add(other);
    other.close();
  }
}

export const hasClosedWindow = () => closed.length > 0;

/** Whether any window of Safari is open. */
export const hasOpenWindow = () => live.size > 0;

let frontPage: { window: LiveSafariWindow; address: string } | null = null;

/** The window in front shows this address: `""` when it is not a web page. */
export function noteFrontPage(window: LiveSafariWindow, address: string): void {
  if (frontPage?.window === window && frontPage.address === address) return;
  frontPage = { window, address };
  changed();
}

/** The address in the front window that is not private, for Same Page and Set to Current Page. */
export const frontSafariPage = () => frontPage?.address ?? "";

/** History > Reopen Last Closed Window. */
export function reopenClosedWindow(): void {
  const window = closed.at(-1);
  if (!window) return;
  closed = closed.slice(0, -1);
  closingNow = closingNow.filter((each) => each !== window);
  lastSession = lastSession.filter((each) => each !== window);
  openSafariWindow({ seeds: window.seeds });
  changed();
}

export const hasLastSession = () => lastSession.length > 0;

/** History > Reopen All Windows from Last Session. */
export function reopenLastSession(): void {
  const windows = lastSession;
  lastSession = [];
  closed = closed.filter((each) => !windows.includes(each));
  closingNow = closingNow.filter((each) => !windows.includes(each));
  for (const { seeds } of windows) openSafariWindow({ seeds });
  changed();
}

export const subscribeSafariWindows = (listener: () => void) => {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
};
export const safariWindowsVersion = () => version;
