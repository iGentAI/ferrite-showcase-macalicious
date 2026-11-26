import { useSyncExternalStore } from "react";

/** What the desktop's View Options window keeps for the account. */
export interface DesktopViewSettings {
  /** The tile, in points. */
  icon: number;
  /** Points added to the pitch of the grid. */
  grid: number;
  /** The size of the names, in points. */
  text: number;
  label: "bottom" | "right";
  /** Show item info: a folder's count, a picture's size in pixels, a file's size in bytes. */
  info: boolean;
  /** Show icon preview: a picture's own bytes as its icon. */
  preview: boolean;
}

export const DESKTOP_VIEW_DEFAULTS: DesktopViewSettings = Object.freeze({
  icon: 64,
  grid: 0,
  text: 12,
  label: "bottom",
  info: false,
  preview: true,
});

export const DESKTOP_ICON_SIZES = { min: 16, max: 128, step: 4 } as const;
export const DESKTOP_GRID_SPACING = { min: 0, max: 64, step: 8 } as const;
export const DESKTOP_TEXT_SIZES = [10, 11, 12, 13, 14, 15, 16] as const;
/** The names' line height, as a share of their size (`--mac-desktop-shell-icon-text-leading`). */
const ICON_LEADING = 1.33;

const inRange = (value: unknown, { min, max }: { min: number; max: number }) =>
  typeof value === "number" && value >= min && value <= max;

/** The settings in a stored value: the value itself, so that a read of it stays the same object. */
export const readDesktopView = (stored: unknown): DesktopViewSettings | undefined => {
  if (!stored || typeof stored !== "object") return undefined;
  const view = stored as Partial<DesktopViewSettings>;
  return inRange(view.icon, DESKTOP_ICON_SIZES) &&
    inRange(view.grid, DESKTOP_GRID_SPACING) &&
    DESKTOP_TEXT_SIZES.some((size) => size === view.text) &&
    (view.label === "bottom" || view.label === "right") &&
    typeof view.info === "boolean" &&
    typeof view.preview === "boolean"
    ? (view as DesktopViewSettings)
    : undefined;
};

/**
 * The pitch of the desktop's grid under these settings. At the defaults it is the measured 116 by
 * 112 of `desktop-icon.css`: room for the tile, the gap under it and two lines of name, and a width
 * that grows only once the tile no longer leaves the name its room. Item info adds a line.
 */
export function cellOfView(view: DesktopViewSettings): { width: number; height: number } {
  const extraText = view.text - DESKTOP_VIEW_DEFAULTS.text;
  const label = Math.ceil(view.text * ICON_LEADING) * (view.info ? 3 : 2);
  if (view.label === "right") {
    return {
      width: view.icon + 120 + extraText * 6 + view.grid,
      height: Math.max(view.icon, label) + 16 + view.grid,
    };
  }
  return {
    width: Math.max(116, view.icon + 52) + view.grid,
    height: view.icon + 16 + label + view.grid,
  };
}

/** Whether the icons look as they do with nothing chosen: Show icon preview changes only pictures. */
export const keepsDefaultLook = (view: DesktopViewSettings) =>
  view.icon === DESKTOP_VIEW_DEFAULTS.icon &&
  view.grid === DESKTOP_VIEW_DEFAULTS.grid &&
  view.text === DESKTOP_VIEW_DEFAULTS.text &&
  view.label === DESKTOP_VIEW_DEFAULTS.label &&
  !view.info;

let panelShown = false;
const listeners = new Set<() => void>();
const subscribe = (listener: () => void) => {
  listeners.add(listener);
  return () => listeners.delete(listener);
};

/** Shows or hides the desktop's View Options window, which the View menu and the desktop both ask for. */
export function showDesktopViewOptions(shown: boolean): void {
  if (shown === panelShown) return;
  panelShown = shown;
  for (const listener of listeners) listener();
}

export const useDesktopViewOptionsShown = () =>
  useSyncExternalStore(
    subscribe,
    () => panelShown,
    () => false,
  );
