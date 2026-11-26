import { useEffect } from "react";
import { showInFinder } from "../finder/finder-open";
import { changeDesktopValue, desktopValues, useDesktopValue } from "./desktop-personal";

/**
 * Hide and Hide Others, as on a Mac: a hidden application's windows go at once, with no animation and
 * no tile of their own in the Dock, and they all come back together when the application is brought
 * back. On the window manager they are minimized windows, marked as hidden here and kept with the
 * person's settings, so a window the person minimized stays apart from them.
 */
export const DESKTOP_HIDDEN = "desktop.hiddenWindows";

const ATTRIBUTE = "data-mac-hidden";
const NONE: readonly string[] = [];

const readHidden = (stored: unknown): readonly string[] | undefined =>
  Array.isArray(stored) ? stored.filter((id) => typeof id === "string") : undefined;

const shellOf = (id: string) =>
  document.querySelector(`.mac-managed-window[data-window-id="${CSS.escape(id)}"]`);

/** The windows hidden now, by id. */
export const hiddenWindows = (): readonly string[] =>
  readHidden(desktopValues()[DESKTOP_HIDDEN]) ?? NONE;

/** Hides the windows `ids` through the manager's `minimize`. */
export function hideWindows(ids: readonly string[], minimize: (id: string) => void): void {
  for (const id of ids) {
    shellOf(id)?.setAttribute(ATTRIBUTE, "");
    minimize(id);
  }
  changeDesktopValue(DESKTOP_HIDDEN, [...new Set([...hiddenWindows(), ...ids])]);
}

export const useHiddenIds = (): readonly string[] =>
  useDesktopValue(DESKTOP_HIDDEN, readHidden, NONE);

/**
 * A main window the person closed, or one opened only to show a panel, while further windows of its application are
 * open: an application renders its further windows from its main window (`desktop.mdx`), so the window stays mounted,
 * out of sight and out of every list, for as long as any of them is open.
 */
const behind = new Set<string>();
/** Those of `behind` that have had a further window to stay for. */
const stayedFor = new Set<string>();
/** Applications whose main window, when it registers, opens behind a panel. */
const opensBehind = new Set<string>();
/** How long a window opened behind a panel waits for it. */
const PANEL_WAIT_MS = 5_000;

export const isClosedBehind = (id: string) => behind.has(id);

/** Whether `id` is a further window of `app`: not its main window, a second main (`app:2`) or its hosted Preferences. */
export const isFurtherWindow = (id: string, app: string) =>
  id.startsWith(`${app}:`) && !/:\d+$/.test(id) && id !== `${app}:preferences`;

/** Takes the window `id` off the screen, through the manager's `minimize`, while further windows of its application stay. */
export function closeBehind(id: string, minimize: (id: string) => void): void {
  behind.add(id);
  shellOf(id)?.setAttribute(ATTRIBUTE, "");
  minimize(id);
}

/**
 * Quick Look of a drive item with no window of Finder open: the panel alone, as a Mac shows it, with Finder's window
 * behind it. A Finder window that is open already stays as it is.
 */
export function quickLookAlone(id: string): void {
  if (!document.querySelector('.mac-managed-window[data-window-id^="finder"]')) {
    opensBehind.add("finder");
    setTimeout(() => opensBehind.delete("finder"), PANEL_WAIT_MS);
  }
  showInFinder({ id, show: "quick-look" });
}

/**
 * Closes for good a window kept behind once no further window of its application is left, and forgets one the person
 * brought back. `close` removes a main window.
 */
export function useFollowBehindWindows(
  windows: readonly { id: string; app: string; minimized: boolean }[],
  minimize: (id: string) => void,
  close: (id: string) => void,
): void {
  useEffect(() => {
    for (const id of behind) {
      const window = windows.find((each) => each.id === id);
      if (!window?.minimized) {
        behind.delete(id);
        stayedFor.delete(id);
        continue;
      }
      if (windows.some((each) => isFurtherWindow(each.id, window.app))) stayedFor.add(id);
      else if (stayedFor.has(id)) forgetBehindAnd(id, close);
    }
    for (const app of opensBehind) {
      if (!windows.some(({ id }) => id === app)) continue;
      opensBehind.delete(app);
      closeBehind(app, minimize);
      setTimeout(() => {
        if (behind.has(app) && !stayedFor.has(app)) forgetBehindAnd(app, close);
      }, PANEL_WAIT_MS);
    }
  });
}

function forgetBehindAnd(id: string, close: (id: string) => void) {
  behind.delete(id);
  stayedFor.delete(id);
  close(id);
}

/**
 * Keeps the hidden windows as the windows go: a window of a hidden application that comes back brings
 * the application's others with it, and one that was closed is forgotten. `settled` says the windows
 * that come back with the desktop have registered; `pending` names one that is yet to be minimized.
 */
export function useFollowHiddenWindows(
  windows: readonly { id: string; app: string; minimized: boolean }[],
  focus: (id: string) => void,
  settled: boolean,
  pending: (id: string) => boolean,
): void {
  const hidden = useHiddenIds();
  useEffect(() => {
    for (const { id, minimized } of windows) {
      shellOf(id)?.toggleAttribute(ATTRIBUTE, minimized && (hidden.includes(id) || behind.has(id)));
    }
    if (!settled || hidden.length === 0) return;
    const windowOf = (id: string) => windows.find((window) => window.id === id);
    const shown = hidden.filter((id) => {
      const window = windowOf(id);
      return window && !window.minimized && !pending(id);
    });
    const appsBack = new Set(shown.map((id) => windowOf(id)?.app));
    const back = hidden.filter((id) => appsBack.has(windowOf(id)?.app));
    for (const id of back) if (!shown.includes(id)) focus(id);
    const first = shown[0];
    if (first !== undefined && back.length > shown.length) focus(first);
    const kept = hidden.filter((id) => windowOf(id) && !back.includes(id));
    if (kept.length !== hidden.length) changeDesktopValue(DESKTOP_HIDDEN, kept);
  });
}
