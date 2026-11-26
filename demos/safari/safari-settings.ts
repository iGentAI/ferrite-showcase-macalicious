import { changeDesktopValue, desktopValues, useDesktopValue } from "../desktop/desktop-personal";

/**
 * Safari's Preferences, kept with the person's desktop values. The Preferences window writes them
 * and every Safari window acts on them. A pop-up button is held under its key in `POP_UP_DEFAULTS`,
 * a checkbox under its title, the Homepage field as `homepage`.
 */
export const SAFARI_SETTINGS = "safari.preferences";

export type SafariSettings = Readonly<Record<string, string | boolean>>;

const NO_SETTINGS: SafariSettings = Object.freeze({});

/** What the stored value holds of settings, leaving out what is neither text nor a choice. */
export function readSafariSettings(stored: unknown): SafariSettings | undefined {
  if (typeof stored !== "object" || stored === null || Array.isArray(stored)) return undefined;
  return Object.fromEntries(
    Object.entries(stored).filter(
      (entry): entry is [string, string | boolean] =>
        typeof entry[1] === "string" || typeof entry[1] === "boolean",
    ),
  );
}

export const useSafariSettings = (): SafariSettings =>
  useDesktopValue(SAFARI_SETTINGS, readSafariSettings, NO_SETTINGS);

/** The settings now, for what is read once as a window opens. */
export const safariSettingsNow = (): SafariSettings =>
  readSafariSettings(desktopValues()[SAFARI_SETTINGS]) ?? NO_SETTINGS;

export function changeSafariSetting(key: string, value: string | boolean): void {
  changeDesktopValue(SAFARI_SETTINGS, { ...safariSettingsNow(), [key]: value });
}

export const POP_UP_DEFAULTS = {
  opens: "A new window",
  windows: "Favorites",
  tabs: "Favorites",
  history: "After one year",
  favorites: "Favorites",
  topSites: "12 sites",
  downloads: "Downloads",
  downloadList: "After one day",
} as const;

export type SafariPopUp = keyof typeof POP_UP_DEFAULTS;

export const choiceOf = (settings: SafariSettings, name: SafariPopUp): string => {
  const value = settings[name];
  return typeof value === "string" ? value : POP_UP_DEFAULTS[name];
};

export const SAFE_FILES = "Open “safe” files after downloading";
export const COMMAND_CLICK = "⌘-click opens a link in a new tab";
export const MAKE_ACTIVE = "When a new tab or window opens, make it active";
export const TAB_KEYS = "Use ⌘-1 through ⌘-9 to switch tabs";
export const AUTO_READER = "Use Reader automatically on pages that have an article";
export const FULL_ADDRESS = "Show full website address";
export const FIELD_FAVORITES = "Show Favorites";
export const ENGINE_SUGGESTIONS = "Include search engine suggestions";

const OPTION_DEFAULTS: Readonly<Record<string, boolean>> = {
  [SAFE_FILES]: true,
  [COMMAND_CLICK]: true,
  [FIELD_FAVORITES]: true,
  [ENGINE_SUGGESTIONS]: true,
};

/**
 * A checkbox's state. `served` is the desktop's Safari, where Open “safe” files starts off: on a
 * Mac it opens what a person downloads, and here the desktop would bring another application to
 * the front on every download of someone who never asked for it.
 */
export function optionOf(settings: SafariSettings, title: string, served = false): boolean {
  const value = settings[title];
  if (typeof value === "boolean") return value;
  if (served && title === SAFE_FILES) return false;
  return OPTION_DEFAULTS[title] ?? false;
}

/** Where "Empty Page" opens: a tab with nothing in it. */
export const EMPTY_PAGE = "safari:empty";

/** What a new tab or window opens with: the choice of its pop-up button, in `start` by default. */
export function newPageAddress(
  choice: string,
  home: string,
  current: string,
  start: string,
): string {
  if (choice === "Homepage") return home;
  if (choice === "Empty Page") return EMPTY_PAGE;
  if (choice === "Same Page") return current;
  return start;
}

const DAY_MS = 86_400_000;
const HISTORY_AGES: Readonly<Record<string, number>> = {
  "After one day": DAY_MS,
  "After one week": 7 * DAY_MS,
  "After two weeks": 14 * DAY_MS,
  "After one month": 30 * DAY_MS,
  "After one year": 365 * DAY_MS,
};

/** The addresses "Remove history items" takes off the history now. */
export function staleVisits(
  visits: readonly { url: string; at: number }[],
  choice: string,
  now: number,
): string[] {
  const age = HISTORY_AGES[choice];
  if (age === undefined) return [];
  return visits.filter((visit) => visit.at < now - age).map((visit) => visit.url);
}

/** The rows "Remove download list items" leaves on the list now. */
export function keptDownloadRows<T extends { at: number }>(
  rows: readonly T[],
  choice: string,
  now: number,
): readonly T[] {
  if (choice === "After one day") {
    const kept = rows.filter((row) => row.at >= now - DAY_MS);
    return kept.length === rows.length ? rows : kept;
  }
  if (choice === "Upon successful download") return rows.length === 0 ? rows : [];
  return rows;
}

const SAFE_NAME =
  /\.(mov|mp4|m4v|m4a|mp3|wav|aiff?|jpe?g|png|gif|tiff?|heic|webp|pdf|txt|rtf|zip|gz|tgz|tar)$/i;

/** The “safe” files of the General pane: movies, pictures, sounds, PDF and text, and archives. */
export const isSafeFile = (name: string): boolean => SAFE_NAME.test(name);
