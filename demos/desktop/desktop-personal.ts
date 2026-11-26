import { useCallback, useMemo, useSyncExternalStore } from "react";

/**
 * The person's own desktop: the Dock's size, magnification, edge and auto-hide, which apps the
 * Dock keeps and in what order, and the desktop picture. All of it is kept with the System Preferences settings
 * (`values` of `/api/system-preferences/settings`, `ferrite-apps/desktop/src/apps/system_preferences`),
 * which the desktop's Ferrite application stores per account, so it follows the person from
 * browser to browser and is nobody else's.
 *
 * The page holds one copy here. System Preferences' settings session (`demos/system-preferences/
 * storage.ts`) connects to it on a served desktop: it hands the stored values over once loaded,
 * hands over every change a pane makes, and takes every change the desktop makes (a Dock tile
 * dragged, an app taken out) to save it. Without that connection (the docs site,
 * `npm run desktop:build`, tests) the copy lives in the page alone and nothing is saved.
 */

export type DesktopValues = Readonly<Record<string, unknown>>;

const EMPTY: DesktopValues = Object.freeze({});
let values: DesktopValues = EMPTY;
let writer: ((key: string, value: unknown) => void) | null = null;
// Set when a session ends and until the next connects: nothing the desktop does then (a drag let
// go after the person logged out) is kept for anyone.
let ended = false;
// Keys the desktop changed while no settings session was connected (the settings were still
// loading): kept over what the load answers, and handed to the session once it connects.
const unsaved = new Set<string>();
const listeners = new Set<() => void>();

function tell() {
  for (const listener of listeners) listener();
}

/** Hear every change of the page's values. Returns the unsubscribe. */
export function subscribeDesktopValues(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

/** The page's values now. */
export const desktopValues = (): DesktopValues => values;

/** Whether a settings session has loaded the person's values and is keeping changes to them. */
export const desktopValuesLoaded = (): boolean => writer !== null;

/**
 * For the settings session: the values as stored, after a load or a pane's change. They replace
 * the page's copy, except for what the desktop changed before a session connected, which is
 * newer than the load.
 */
export function receiveDesktopValues(next: DesktopValues | null): void {
  const kept = Object.fromEntries([...unsaved].map((key) => [key, values[key]]));
  values = next || unsaved.size > 0 ? { ...next, ...kept } : EMPTY;
  tell();
}

/**
 * For the settings session: a new session begins (its settings are being asked for). Changes the
 * desktop makes from now on are this person's again, kept until it connects.
 */
export function beginDesktopValues(): void {
  ended = false;
}

/**
 * For the settings session: from now on every change the desktop makes is handed to `write`,
 * which saves it, starting with those made while the settings loaded. Returns the disconnect,
 * which also forgets the values and the desktop picture: a page whose session ended shows
 * nobody's settings.
 */
export function connectDesktopValues(write: (key: string, value: unknown) => void): () => void {
  writer = write;
  ended = false;
  // Taken before any is written: each write goes through the session, which hands the page its
  // own record of the values back.
  const pending = [...unsaved].map((key) => [key, values[key]] as const);
  unsaved.clear();
  for (const [key, value] of pending) write(key, value);
  tell();
  return () => {
    if (writer !== write) return;
    writer = null;
    forgetDesktopValues();
  };
}

/**
 * Forget the page's values, the changes waiting to be saved and the desktop picture, and drop any
 * picture still being read: a settings session ended, loaded or not, and nothing of its person
 * stays on the page.
 */
export function forgetDesktopValues(): void {
  ended = true;
  unsaved.clear();
  values = EMPTY;
  tell();
  resetDesktopPicture();
}

/**
 * Change one value: shown at once, and saved when the settings session is connected. Once a
 * session has ended, a change is nobody's and is dropped.
 */
export function changeDesktopValue(key: string, value: unknown): void {
  if (ended || Object.is(values[key], value)) return;
  values = { ...values, [key]: value };
  tell();
  if (writer) writer(key, value);
  else unsaved.add(key);
}

/** The value under `key` read by `read`, or `fallback` when it is absent or `read` refuses it. */
export function useDesktopValue<T>(
  key: string,
  read: (stored: unknown) => T | undefined,
  fallback: T,
): T {
  const stored = useSyncExternalStore(
    subscribeDesktopValues,
    () => values[key],
    () => undefined,
  );
  return stored === undefined ? fallback : (read(stored) ?? fallback);
}

/** `useDesktopValue` with its setter. */
export function useDesktopSetting<T>(
  key: string,
  read: (stored: unknown) => T | undefined,
  fallback: T,
): [T, (next: T) => void] {
  const value = useDesktopValue(key, read, fallback);
  const set = useCallback((next: T) => changeDesktopValue(key, next), [key]);
  return [value, set];
}

// ---------------------------------------------------------------------------------------------
// Keys and readers. The Dock pane of System Preferences writes the `dock.*` settings with the
// same keys and defaults (`demos/system-preferences/panes/dock/dock.tsx`).

export const DOCK_SIZE = "dock.size";
export const DOCK_MAGNIFY = "dock.magnification";
export const DOCK_MAGNIFICATION = "dock.magnificationSize";
export const DOCK_POSITION = "dock.position";
export const DOCK_AUTOHIDE = "dock.autohide";
/** The ids of the Dock's apps in the order the person put them. */
export const DOCK_ORDER = "dock.order";
/** The ids of the apps the person took out of the Dock. */
export const DOCK_REMOVED = "dock.removed";
/** The drive ids of the folders and files the person keeps in the Dock. */
export const DOCK_KEPT = "dock.kept";

/** What the Dock keeps, as the setting holds it. */
export const readDockKept = (stored: unknown): readonly string[] | undefined =>
  Array.isArray(stored) ? stored.filter((id) => typeof id === "string") : undefined;

/** Keeps these items of the drive in the Dock, after those it keeps; those it has stay where they are. */
export function keepInDock(ids: readonly string[]): void {
  const kept = readDockKept(desktopValues()[DOCK_KEPT]) ?? [];
  changeDesktopValue(DOCK_KEPT, [...kept, ...ids.filter((id) => !kept.includes(id))]);
}

/** Option-Command-D, and the row of the divider's menu. */
export function toggleDockHiding(): void {
  changeDesktopValue(DOCK_AUTOHIDE, readBoolean(desktopValues()[DOCK_AUTOHIDE]) !== true);
}

export const readNumber = (stored: unknown): number | undefined =>
  typeof stored === "number" && Number.isFinite(stored) ? stored : undefined;
export const readBoolean = (stored: unknown): boolean | undefined =>
  typeof stored === "boolean" ? stored : undefined;

export type DockPosition = "bottom" | "left" | "right";
export const readPosition = (stored: unknown): DockPosition | undefined =>
  stored === "bottom" || stored === "left" || stored === "right" ? stored : undefined;

const APP_ID = /^[a-z0-9-]{1,64}$/;
/** A list of app ids, without repeats. */
export function readIds(stored: unknown): readonly string[] | undefined {
  if (!Array.isArray(stored) || !stored.every((id) => typeof id === "string" && APP_ID.test(id)))
    return undefined;
  return [...new Set(stored as string[])];
}

/** The least and largest tile of the Dock preference's Size slider, in points. */
export const DOCK_TILE_MIN = 16;
export const DOCK_TILE_MAX = 128;
/** The Size slider's default: a 64 pt tile, the Dock of the screenshots. */
export const DOCK_SIZE_DEFAULT = 42.5;
/** The Magnification slider's default: its largest, 128 pt. */
export const DOCK_MAGNIFICATION_DEFAULT = 100;

/** A slider's place (0 to 100) as a tile size in points, 16 to 128, rounded to whole points. */
export function sliderToTile(place: number): number {
  const clamped = Math.min(100, Math.max(0, place));
  return Math.round(DOCK_TILE_MIN + (clamped / 100) * (DOCK_TILE_MAX - DOCK_TILE_MIN));
}

/** The Dock as the person set it up in System Preferences > Dock. */
export interface DockPreferences {
  /** The tile size chosen, in points; a full Dock shrinks its tiles below it to fit. */
  tile: number;
  /** The size the tile under the pointer grows to, or `undefined` without magnification. */
  magnification: number | undefined;
  position: DockPosition;
  autohide: boolean;
}

/** The Dock preferences that `values` hold, with the pane's defaults for the rest. */
export function dockPreferences(stored: DesktopValues): DockPreferences {
  const tile = sliderToTile(readNumber(stored[DOCK_SIZE]) ?? DOCK_SIZE_DEFAULT);
  const magnify = readBoolean(stored[DOCK_MAGNIFY]) ?? false;
  const grown = sliderToTile(readNumber(stored[DOCK_MAGNIFICATION]) ?? DOCK_MAGNIFICATION_DEFAULT);
  return {
    tile,
    magnification: magnify && grown > tile ? grown : undefined,
    position: readPosition(stored[DOCK_POSITION]) ?? "bottom",
    autohide: readBoolean(stored[DOCK_AUTOHIDE]) ?? false,
  };
}

/** The page's Dock preferences, following every change. */
export function useDockPreferences(): DockPreferences {
  const stored = useSyncExternalStore(subscribeDesktopValues, desktopValues, () => EMPTY);
  // The record is rebuilt only when one of its values changes.
  const size = stored[DOCK_SIZE];
  const magnify = stored[DOCK_MAGNIFY];
  const magnification = stored[DOCK_MAGNIFICATION];
  const position = stored[DOCK_POSITION];
  const autohide = stored[DOCK_AUTOHIDE];
  return useMemo(
    () =>
      dockPreferences({
        [DOCK_SIZE]: size,
        [DOCK_MAGNIFY]: magnify,
        [DOCK_MAGNIFICATION]: magnification,
        [DOCK_POSITION]: position,
        [DOCK_AUTOHIDE]: autohide,
      }),
    [size, magnify, magnification, position, autohide],
  );
}

/**
 * The Dock's apps: those the person has (`installed`, in the order the desktop lists them) less
 * those taken out, in the person's order; an app not in that order (one got since) follows in
 * the desktop's order.
 */
export function dockedIds(
  installed: readonly string[],
  order: readonly string[],
  removed: readonly string[],
): string[] {
  const kept = installed.filter((id) => !removed.includes(id));
  const rank = new Map(order.map((id, index) => [id, index]));
  const placed = kept.filter((id) => rank.has(id));
  placed.sort((a, b) => (rank.get(a) ?? 0) - (rank.get(b) ?? 0));
  return [...placed, ...kept.filter((id) => !rank.has(id))];
}

/** `docked` with `id` moved to `index` (clamped); `docked` itself when nothing moves. */
export function moveId(docked: readonly string[], id: string, index: number): readonly string[] {
  const from = docked.indexOf(id);
  if (from < 0) return docked;
  const to = Math.min(Math.max(Math.round(index), 0), docked.length - 1);
  if (from === to) return docked;
  const next = docked.filter((each) => each !== id);
  next.splice(to, 0, id);
  return next;
}

// ---------------------------------------------------------------------------------------------
// The desktop picture. Whatever chooses one (System Preferences > Desktop & Screen Saver,
// Photos' Set Desktop Picture, the stored choice restored when the desktop starts) tells the page
// with one window event; the latest is kept here, so a desktop that mounts after it was sent
// still shows it.

/** The window event that names the desktop picture. */
export const DESKTOP_PICTURE_EVENT = "macalicious:desktop-picture";

/** What the event carries. */
export interface DesktopPictureDetail {
  /** The picture under Aqua, or by day. */
  day?: string;
  /** The picture under Dark Aqua, or by night. */
  night?: string;
  /**
   * `auto`: the day picture under Aqua and the night one under Dark Aqua; `day` or `night`: that
   * one always; `time`: by the browser's clock, the day picture from 7 in the morning to 7 in the
   * evening (a dynamic desktop set to Dynamic).
   */
  look?: "auto" | "day" | "night" | "time";
  /** Who chose it: `photos`, `system-preferences`. */
  source?: string;
  /** The drive file the picture was read from, when it was: what can be read again after a reload. */
  file?: string;
  /** Set when the desktop's stored choice is shown again at start: no new choice to keep. */
  restored?: boolean;
  /**
   * The person's choice this picture answers (`takePictureTicket`, taken when they acted). A
   * picture whose choice is no longer the newest is not shown: a slow read never wins over a
   * newer choice.
   */
  choice?: number;
  /**
   * The session the choice was made in (`takePictureTicket`). A picture of a session that has
   * ended is not shown.
   */
  generation?: number;
}

// The person's choices of a desktop picture on this page. Only an explicit action of theirs takes
// a choice (picking one of the pane's pictures or a mode, picking a drive picture, uploading,
// setting a photo in Photos), at the moment they act, and the newest choice wins: a picture that
// has to be read first is shown only if its choice is still the newest when the read ends. Reads,
// thumbnails and other things finishing in the background never take a choice.
let latestChoice = 0;

/** Take a choice for an action of the person's, at the moment they act. */
export function takePictureChoice(): number {
  latestChoice += 1;
  return latestChoice;
}

/** Whether `choice` is still the person's newest. */
export const isLatestPictureChoice = (choice: number): boolean => choice === latestChoice;

/** The newest choice now, to tell later whether the person has chosen since. */
export const currentPictureChoice = (): number => latestChoice;

/** A choice and the session it was made in, taken when the person acts. */
export interface PictureTicket {
  choice: number;
  generation: number;
}

/**
 * Take a ticket for an action of the person's that shows a picture later (Photos' Set Desktop
 * Picture): pass it on the picture's detail. Photos' choices without one are not shown or kept.
 */
export function takePictureTicket(): PictureTicket {
  return { choice: takePictureChoice(), generation: pictureGeneration };
}

/** Whether a ticket's choice is still the newest and its session still the page's. */
export const isCurrentPictureTicket = (ticket: Partial<PictureTicket>): boolean =>
  (ticket.choice === undefined || isLatestPictureChoice(ticket.choice)) &&
  (ticket.generation === undefined || ticket.generation === pictureGeneration);

/**
 * Whether a picture named on the page is shown: none while a session has ended and no other has
 * begun; not one answering an older choice, or made for a session that has ended; nor a choice
 * in Photos without its ticket.
 */
export function isPictureShown(detail: DesktopPictureDetail): boolean {
  // A session has ended and no other has begun: the page shows nobody's picture.
  if (ended) return false;
  if (detail.source === "photos" && !detail.restored) {
    if (detail.choice === undefined || detail.generation === undefined) return false;
  }
  return isCurrentPictureTicket(detail);
}

let lastPicture: DesktopPictureDetail | null = null;
const pictureListeners = new Set<() => void>();
let pictureHeard = false;

function hearPictures() {
  if (pictureHeard || typeof window === "undefined") return;
  pictureHeard = true;
  window.addEventListener(DESKTOP_PICTURE_EVENT, (event) => {
    const detail = (event as CustomEvent<DesktopPictureDetail | undefined>).detail;
    if (detail && typeof detail === "object" && !isPictureShown(detail)) return;
    lastPicture = detail && typeof detail === "object" ? { ...detail } : null;
    for (const listener of pictureListeners) listener();
  });
}
hearPictures();

/** Hear every picture named. Returns the unsubscribe. */
export function subscribeDesktopPicture(listener: () => void): () => void {
  hearPictures();
  pictureListeners.add(listener);
  return () => {
    pictureListeners.delete(listener);
  };
}

/** The picture last named on this page, or `null` before any. */
export const lastDesktopPicture = (): DesktopPictureDetail | null => lastPicture;

// Photos names a picture at once by the page's own address and saves it to the drive after: the file
// each such address came to be, for this session.
const savedPictures = new Map<string, string>();

/** A picture named by `address` has been saved to the drive as `file`. */
export function notePictureFile(address: string, file: string): void {
  savedPictures.set(address, file);
  for (const listener of pictureListeners) listener();
}

export const pictureFileOf = (address: string): string | undefined => savedPictures.get(address);

export const savedPictureCount = (): number => savedPictures.size;

// Counts the sessions' ends: a picture that was still being read when one ended (a file of the
// drive, Photos' photo) belongs to the person before, and is not shown.
let pictureGeneration = 0;

/** The number of sessions that have ended on this page, for a read to check that it is current. */
export const desktopPictureGeneration = (): number => pictureGeneration;

/**
 * Forget the picture named, so the desktop shows its own again (a session ended), and drop any
 * picture still being read for the session that ended.
 */
export function resetDesktopPicture(): void {
  pictureGeneration += 1;
  lastPicture = null;
  savedPictures.clear();
  // Told even when no picture was shown: an upload under way listens for the session's end.
  for (const listener of pictureListeners) listener();
}

/** Name a picture to the desktop. */
export function showDesktopPicture(detail: DesktopPictureDetail): void {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent(DESKTOP_PICTURE_EVENT, { detail }));
}

/** Whether the browser's clock says day: from 7:00 to 18:59. */
export const isDaytime = (date: Date): boolean => date.getHours() >= 7 && date.getHours() < 19;

/**
 * The two pictures the desktop layers for a detail (`day` under Aqua, `night` under Dark Aqua),
 * with `fallback` for what it does not name; `time` is judged at `now`.
 */
export function pictureLayers(
  detail: DesktopPictureDetail | null,
  fallback: { day: string; night: string },
  now: Date,
): { day: string; night: string } {
  if (!detail) return fallback;
  const day = detail.day ?? fallback.day;
  const night = detail.night ?? fallback.night;
  const look = detail.look === "time" ? (isDaytime(now) ? "day" : "night") : detail.look;
  if (look === "day") return { day, night: day };
  if (look === "night") return { day: night, night };
  return { day, night };
}
