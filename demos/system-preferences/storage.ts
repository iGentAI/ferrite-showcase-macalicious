import {
  ACCENTS,
  type Accent,
  type Appearance,
  setAccent,
  setAppearance,
  setHighlight,
} from "macalicious/lib/appearance";
import { useEffect, useState } from "react";
import {
  beginDesktopValues,
  connectDesktopValues,
  DESKTOP_PICTURE_EVENT,
  type DesktopPictureDetail,
  forgetDesktopValues,
  isCurrentPictureTicket,
  isPictureShown,
  notePictureFile,
  receiveDesktopValues,
} from "../desktop/desktop-personal";
import { servedByDesktopApp, serverDocument } from "../desktop/desktop-server";
import { mergeRecentApps, RECENT_APPS } from "../desktop/desktop-system";
import { type DocumentMerge, mergeDocuments, sameDocument } from "../desktop/document-merge";
import type { ObservableSettings } from "./pane";
import {
  currentPictureChoice,
  driveFileOf,
  isLatestPictureChoice,
  keepPhotosPicture,
  PHOTOS_PICTURE,
  PICTURE_KEY,
  showStoredPicture,
} from "./panes/desktop-and-screen-saver/stored-picture";
import {
  applySettingEffects,
  clearSettingEffects,
  listenForTitleBarDoubleClicks,
} from "./setting-effects";

/**
 * System Preferences' settings as its module of the `macalicious-desktop` Ferrite application
 * keeps them (`ferrite-apps/desktop/src/apps/system_preferences`): `GET` and `PUT` of
 * `{ values, theme, rev }`. `values` are the panes' settings by key, as `usePreference` keeps
 * them; `theme` is the appearance, accent colour and highlight colour of the page; `rev` is the
 * server's revision of the document.
 */
export const SETTINGS_URL = "/api/system-preferences/settings";

/** The theme as the module stores it: `null` for a custom accent, or a highlight that follows the accent. */
export interface StoredTheme {
  appearance: Appearance;
  accent: Accent | null;
  highlight: Accent | null;
}

const THEME_ATTRIBUTES = ["data-appearance", "data-accent", "data-highlight"];

const isAccent = (name: unknown): name is Accent =>
  typeof name === "string" && (ACCENTS as readonly string[]).includes(name);

/**
 * The panes' settings, which tells `onChange` about every `set` (the key and the value): how
 * the window hears that a pane changed one (`usePreference` writes to the map). `assign` puts
 * a value in without telling `onChange`, as a value that came from elsewhere is no change of
 * this window's, but tells the mounted controls (`subscribe`, used by `usePreference`), so they
 * show it at once.
 */
export class SettingsMap extends Map<string, unknown> implements ObservableSettings {
  onChange?: (key: string, value: unknown) => void;
  readonly #listeners = new Set<(key: string) => void>();

  override set(key: string, value: unknown): this {
    super.set(key, value);
    this.onChange?.(key, value);
    return this;
  }

  assign(key: string, value: unknown): void {
    super.set(key, value);
    for (const listener of this.#listeners) listener(key);
  }

  subscribe(listener: (key: string) => void): () => void {
    this.#listeners.add(listener);
    return () => {
      this.#listeners.delete(listener);
    };
  }
}

/** The theme an element sets for itself: no attribute reads as Auto and blue. */
export function themeOf(target: HTMLElement): StoredTheme {
  const appearance = target.getAttribute("data-appearance");
  const accent = target.getAttribute("data-accent") ?? "blue";
  const highlight = target.getAttribute("data-highlight");
  return {
    appearance: appearance === "light" || appearance === "dark" ? appearance : "auto",
    accent: isAccent(accent) ? accent : null,
    highlight: isAccent(highlight) ? highlight : null,
  };
}

/** Set a stored theme on an element. A custom accent (`null`) leaves the accent alone. */
export function applyTheme(theme: StoredTheme, target: HTMLElement): void {
  setAppearance(theme.appearance, target);
  if (theme.accent) setAccent(theme.accent, target);
  setHighlight(theme.highlight ?? "accent", target);
}

/**
 * How a change of the settings meets newer settings saved elsewhere (another browser, or a forget
 * in Storage Management). Each setting is its own: the ones the change set are kept, onto the
 * newer settings, or onto nothing when they were forgotten, and no other setting this page still
 * holds comes back. The theme is one value, the page's when it changed it. Recent Items is the one
 * setting two windows change as a list of their own: when both still hold it, the apps each
 * opened are kept, newest first (`mergeRecentApps`), not one window's list whole.
 */
export const mergeSettings: DocumentMerge = (base, mine, theirs) => {
  const merged = mergeDocuments(base, mine, theirs, { reapply: true }) as Record<string, unknown>;
  const theme = (doc: object | null) => (doc as { theme?: unknown } | null)?.theme;
  const changed = !sameDocument(theme(mine), theme(base));
  return {
    ...withRecentApps(merged, base, mine, theirs),
    theme: (changed ? theme(mine) : theme(theirs)) ?? null,
  };
};

/** `merged` with Recent Items merged from both windows' lists, when both still hold one. */
function withRecentApps(
  merged: Record<string, unknown>,
  base: object | null,
  mine: object | null,
  theirs: object | null,
): Record<string, unknown> {
  const valuesOf = (doc: object | null) =>
    (doc as { values?: Record<string, unknown> | null } | null)?.values ?? null;
  const values = merged.values as Record<string, unknown> | null | undefined;
  const ours = valuesOf(mine)?.[RECENT_APPS];
  const other = valuesOf(theirs)?.[RECENT_APPS];
  if (!values || ours === undefined || other === undefined) return merged;
  const recent = mergeRecentApps(valuesOf(base)?.[RECENT_APPS], ours, other);
  return recent ? { ...merged, values: { ...values, [RECENT_APPS]: recent } } : merged;
}

interface StoredSettings {
  values: Record<string, unknown> | null;
  theme: StoredTheme | null;
  /**
   * Whether the reply is the module's: each half absent, `null` or well formed. A reply that is
   * not was never read, so nothing may be saved over it.
   */
  valid: boolean;
}

/** What a `GET` reply holds, each half `null` when it is absent or not the module's. */
export function settingsFromServer(reply: unknown): StoredSettings {
  const body = (reply ?? {}) as { values?: unknown; theme?: unknown };
  const values =
    typeof body.values === "object" && body.values !== null && !Array.isArray(body.values)
      ? (body.values as Record<string, unknown>)
      : null;
  const theme = body.theme as Partial<StoredTheme> | null | undefined;
  const themeValid =
    typeof theme === "object" &&
    theme !== null &&
    (theme.appearance === "light" || theme.appearance === "dark" || theme.appearance === "auto") &&
    (theme.accent === null || isAccent(theme.accent)) &&
    (theme.highlight === null || isAccent(theme.highlight));
  const absent = (value: unknown) => value === undefined || value === null;
  return {
    values,
    theme: themeValid ? (theme as StoredTheme) : null,
    valid:
      typeof reply === "object" &&
      reply !== null &&
      !Array.isArray(reply) &&
      (absent(body.values) || values !== null) &&
      (absent(body.theme) || themeValid),
  };
}

/**
 * The page's settings while anything on it holds them: the desktop from when it starts, and
 * every System Preferences window while it is open. One `GET` loads them once for all of
 * them, so the desktop's theme and the window's panes never come from two loads that could
 * disagree, and a window opened again reads what the page holds now. From then on every
 * change, whoever makes it, saves the whole document: a pane's setting through `setValues`,
 * and the page's theme whenever its attributes change, also while no System Preferences window
 * is open (the menu bar, a keyboard shortcut, another demo).
 */
interface SettingsSession {
  holders: number;
  /** Settles when the load has answered or failed. */
  ready: Promise<void>;
  /** Whether the load succeeded: only then is anything saved. */
  loaded: boolean;
  /** The page's settings: what was loaded, with every change made since. */
  values: Record<string, unknown> | null;
  /** The open windows' maps, each kept up to date with the page's settings. */
  windows: Set<SettingsMap>;
  /**
   * One setting changed in the window `from`, or on the desktop itself (`null`: a Dock tile
   * dragged, an icon or a window moved, a picture chosen in Photos): the windows get it, and the
   * page saves.
   */
  setValue: (key: string, value: unknown, from: SettingsMap | null) => void;
  stop: () => void;
}

let session: SettingsSession | null = null;

function startSession(): SettingsSession {
  const page = document.documentElement;
  const channel = serverDocument(SETTINGS_URL, { merge: mergeSettings, keptOverReload: true });
  // This person's session begins: the desktop's changes are theirs from now on.
  beginDesktopValues();
  let stopped = false;
  // Theme changes on the page since the load was sent, counted by the observer. Any change in
  // that time is newer than the stored theme, whichever task made it, so the stored theme is put
  // on the page only if there was none: the local theme wins, and is saved.
  let localChanges = 0;
  const save = () => {
    if (current.loaded && !stopped) {
      channel.save({ values: current.values, theme: themeOf(page) });
    }
  };
  const observer = new MutationObserver((records) => {
    if (current.loaded) save();
    else localChanges += records.length;
  });
  // Attached before the load is sent, so that no change made after the request is missed.
  observer.observe(page, { attributes: true, attributeFilter: THEME_ATTRIBUTES });
  // The desktop's own settings (desktop-personal.ts) are these values: connected once loaded.
  let disconnect: (() => void) | null = null;
  // Gives up the read of a stored picture when the session ends.
  const stopDoubleClicks = listenForTitleBarDoubleClicks();
  const pictureRead = new AbortController();
  // The person's picture choices so far: one made after this, before the settings have loaded,
  // is newer than the stored one, which is then not shown again.
  const choiceAtStart = currentPictureChoice();
  // A photo set in Photos before the settings loaded, saved to the drive: kept once they have, if
  // its choice is still the person's newest.
  let photoChoice: { choice: number; picture: string } | null = null;
  // A photo made the desktop picture in Photos is the person's choice from now on: kept only with
  // the ticket Photos took when the person acted, and only while that choice is still their
  // newest and the session the one it was made in. Its picture is saved to the person's drive
  // (keepPhotosPicture), so the choice is a drive picture, shown again after a reload; a newer
  // choice made while it is saved wins, and nothing outlives the session.
  const pictureChosen = (event: Event) => {
    const detail = (event as CustomEvent<DesktopPictureDetail | undefined>).detail;
    if (detail?.source !== PHOTOS_PICTURE || detail.restored || !isPictureShown(detail)) return;
    const choice = detail.choice;
    if (choice === undefined) return;
    keepPhotosPicture(detail, pictureRead.signal).then(
      (picture) => {
        // Checked again as it is saved: a newer choice made since the photo was stored wins.
        if (!picture || stopped || !isCurrentPictureTicket(detail)) return;
        if (current.loaded) current.setValue(PICTURE_KEY, picture, null);
        else photoChoice = { choice, picture };
        const file = driveFileOf(picture);
        if (file && detail.day) notePictureFile(detail.day, file);
      },
      (error: unknown) => {
        if (!pictureRead.signal.aborted) {
          console.warn(`The photo could not be kept as the desktop picture (${error})`);
        }
      },
    );
  };
  window.addEventListener(DESKTOP_PICTURE_EVENT, pictureChosen);
  const current: SettingsSession = {
    holders: 0,
    loaded: false,
    values: null,
    ready: channel.load().then((reply) => {
      // Changes the observer has not been told of yet count too.
      localChanges += observer.takeRecords().length;
      const themeChanged = localChanges > 0;
      if (stopped || reply === undefined) return;
      const stored = settingsFromServer(reply);
      // Settings that could not be read are never saved over: the session stays unloaded.
      if (!stored.valid) return;
      current.values = stored.values;
      if (!themeChanged && stored.theme) {
        applyTheme(stored.theme, page);
        // Putting the stored theme back is no change to save.
        observer.takeRecords();
      }
      current.loaded = true;
      // Keep the newer theme rather than lose it on the next reload.
      if (themeChanged) save();
      // The desktop shows the person's Dock, icons, windows and picture from now on, and saves
      // its changes to them here.
      receiveDesktopValues(current.values);
      applySettingEffects(current.values ?? {});
      disconnect = connectDesktopValues((key, value) => current.setValue(key, value, null));
      if (photoChoice !== null && isLatestPictureChoice(photoChoice.choice)) {
        current.setValue(PICTURE_KEY, photoChoice.picture, null);
      }
      void showStoredPicture(current.values, pictureRead.signal, choiceAtStart);
    }),
    setValue: (key, value, from) => {
      current.values = { ...current.values, [key]: value };
      for (const map of current.windows) if (map !== from) map.assign(key, value);
      receiveDesktopValues(current.values);
      applySettingEffects(current.values);
      save();
    },
    windows: new Set(),
    stop: () => {
      stopped = true;
      observer.disconnect();
      stopDoubleClicks();
      clearSettingEffects();
      window.removeEventListener(DESKTOP_PICTURE_EVENT, pictureChosen);
      pictureRead.abort();
      // A session that ends before its settings loaded leaves nothing either.
      if (disconnect) disconnect();
      else forgetDesktopValues();
    },
  };
  return current;
}

function holdSettings(): SettingsSession {
  session ??= startSession();
  session.holders += 1;
  return session;
}

function releaseSettings(held: SettingsSession) {
  held.holders -= 1;
  if (held.holders > 0) return;
  held.stop();
  if (session === held) session = null;
}

/**
 * For the desktop when it starts (the descriptor's `onDesktopStart`): on a desktop served by
 * the Ferrite application, load the session's settings, put its saved theme on the page, and
 * keep the theme saved from then on, so that a chosen appearance and accent colour hold after
 * a reload whether or not System Preferences is open. If the page's theme changes after the
 * load is sent and before the reply comes, that theme is newer: it is kept and saved, and the
 * stored one is dropped.
 * Returns the cleanup.
 */
export function restoreSavedTheme(): () => void {
  if (!servedByDesktopApp()) return () => {};
  const held = holdSettings();
  let released = false;
  return () => {
    if (released) return;
    released = true;
    releaseSettings(held);
  };
}

/**
 * On a desktop served by the Ferrite application: put the page's settings (loaded once, see
 * `SettingsSession`) into `values` when the window mounts, then save each setting a pane
 * changes into the page's settings, which every other open window's map receives too. A
 * window sends only what it changed, never its whole map, so a window that was open while
 * another changed a setting cannot undo that change. The page's theme is the page's own, kept
 * by the same session. Nothing is saved before the load has succeeded, so settings that could
 * not be read are never overwritten. Returns whether that load is still under way: the window
 * keeps its content inert meanwhile, so no setting is changed that the load would replace. A
 * load that fails ends the wait too, and the window then saves nothing.
 */
export function useServerSettings(values: SettingsMap): boolean {
  const [loading, setLoading] = useState(servedByDesktopApp);
  useEffect(() => {
    if (!servedByDesktopApp()) return;
    const held = holdSettings();
    let live = true;
    const changed = (key: string, value: unknown) => held.setValue(key, value, values);
    void held.ready.then(() => {
      if (!live) return;
      if (held.loaded) {
        for (const [key, value] of Object.entries(held.values ?? {})) values.assign(key, value);
        held.windows.add(values);
        values.onChange = changed;
      }
      setLoading(false);
    });
    return () => {
      live = false;
      held.windows.delete(values);
      if (values.onChange === changed) values.onChange = undefined;
      releaseSettings(held);
    };
  }, [values]);
  return loading;
}
