import type { CursorShape } from "./terminal-emulator";

/**
 * Terminal's profiles and its preferences. No screenshot of Terminal is in the reference set, so the
 * ten profiles' colours and sizes are [provisional]: written from knowledge of macOS 10.15, not
 * measured. A colour of `null` is Basic's, the token that follows the appearance.
 */

export type AskBeforeClosing = "always" | "never" | "running";

export type WhenShellExits = "keep" | "close-clean" | "close";

export interface TerminalProfile {
  name: string;
  background: string | null;
  foreground: string | null;
  bold: string | null;
  selection: string | null;
  cursor: string | null;
  /** The font's family; `null` is the system's monospaced font. */
  fontFamily: string | null;
  fontSize: number;
  cursorShape: CursorShape;
  cursorBlink: boolean;
  columns: number;
  rows: number;
  /** The name a window of this profile shows, instead of the folder. */
  windowTitle: string;
  showDirectory: boolean;
  showProcess: boolean;
  showSize: boolean;
  /** The name a tab of this profile shows, instead of the folder. */
  tabTitle: string;
  tabShowProcess: boolean;
  /** What a new shell of this profile runs first. */
  startupCommand: string;
  startupInShell: boolean;
  whenExits: WhenShellExits;
  /** When closing a tab or window asks first: `running` while a command runs. */
  askBeforeClosing: AskBeforeClosing;
  optionAsMeta: boolean;
  audibleBell: boolean;
  visualBell: boolean;
}

const BASE: Omit<TerminalProfile, "name"> = {
  background: null,
  foreground: null,
  bold: null,
  selection: null,
  cursor: null,
  fontFamily: null,
  fontSize: 11,
  cursorShape: "block",
  cursorBlink: false,
  columns: 80,
  rows: 24,
  windowTitle: "",
  showDirectory: true,
  showProcess: true,
  showSize: true,
  tabTitle: "",
  tabShowProcess: true,
  startupCommand: "",
  startupInShell: true,
  whenExits: "keep",
  askBeforeClosing: "running",
  optionAsMeta: false,
  audibleBell: false,
  visualBell: true,
};

const colours = (
  background: string,
  foreground: string,
  bold: string,
  selection: string,
  cursor: string,
) => ({ background, foreground, bold, selection, cursor });

/** The ten profiles a Mac comes with, in the list's order. */
export const BUILT_IN_PROFILES: readonly TerminalProfile[] = [
  { ...BASE, name: "Basic" },
  {
    ...BASE,
    name: "Grass",
    ...colours("#13773d", "#fff0a5", "#ffb03b", "#b64926", "#8c2800"),
    fontSize: 12,
  },
  {
    ...BASE,
    name: "Homebrew",
    ...colours("#000000", "#28fe14", "#28fe14", "#0000ff", "#38fe27"),
    fontSize: 12,
  },
  {
    ...BASE,
    name: "Man Page",
    ...colours("#fef49c", "#000000", "#000000", "#a4c9cd", "#7f7f7f"),
    fontSize: 12,
  },
  {
    ...BASE,
    name: "Novel",
    ...colours("#dfdbc3", "#3b2322", "#8b0000", "#a4a390", "#3a2322"),
    fontSize: 12,
  },
  {
    ...BASE,
    name: "Ocean",
    ...colours("#224fbc", "#ffffff", "#ffffff", "#216dff", "#7f7f7f"),
    fontSize: 12,
  },
  {
    ...BASE,
    name: "Pro",
    ...colours("#000000", "#f2f2f2", "#ffffff", "#414141", "#4d4d4d"),
    fontSize: 12,
  },
  {
    ...BASE,
    name: "Red Sands",
    ...colours("#7a251e", "#d7c9a7", "#dfbd22", "#a4a390", "#ffffff"),
    fontSize: 12,
  },
  {
    ...BASE,
    name: "Silver Aerogel",
    ...colours("#929292", "#000000", "#ffffff", "#d7d7d7", "#7f7f7f"),
    fontSize: 12,
  },
  {
    ...BASE,
    name: "Solid Colors",
    ...colours("#000000", "#ffffff", "#ffffff", "#3f638b", "#7f7f7f"),
    fontSize: 12,
  },
];

const COLOUR = /^#[0-9a-f]{6}$/i;
const MOST_COLUMNS = 400;
const MOST_ROWS = 200;
export const MIN_FONT_SIZE = 6;
export const MAX_FONT_SIZE = 48;

/** What of `stored` is a valid part of a profile: anything else in it is left out. */
export function readProfileChanges(stored: unknown): Partial<TerminalProfile> {
  if (typeof stored !== "object" || stored === null) return {};
  const from = stored as Record<string, unknown>;
  const out: Record<string, unknown> = {};
  for (const key of ["background", "foreground", "bold", "selection", "cursor"]) {
    const value = from[key];
    if (value === null || (typeof value === "string" && COLOUR.test(value))) out[key] = value;
  }
  for (const key of ["name", "windowTitle", "tabTitle", "startupCommand"]) {
    if (typeof from[key] === "string") out[key] = from[key];
  }
  if (from.fontFamily === null || typeof from.fontFamily === "string") {
    out.fontFamily = from.fontFamily;
  }
  for (const key of [
    "cursorBlink",
    "showDirectory",
    "showProcess",
    "showSize",
    "tabShowProcess",
    "startupInShell",
    "optionAsMeta",
    "audibleBell",
    "visualBell",
  ]) {
    if (typeof from[key] === "boolean") out[key] = from[key];
  }
  const whole = (value: unknown, least: number, most: number) =>
    typeof value === "number" && Number.isInteger(value) && value >= least && value <= most;
  if (whole(from.fontSize, MIN_FONT_SIZE, MAX_FONT_SIZE)) out.fontSize = from.fontSize;
  if (whole(from.columns, 20, MOST_COLUMNS)) out.columns = from.columns;
  if (whole(from.rows, 2, MOST_ROWS)) out.rows = from.rows;
  if (["block", "underline", "bar"].includes(from.cursorShape as string)) {
    out.cursorShape = from.cursorShape;
  }
  if (["keep", "close-clean", "close"].includes(from.whenExits as string)) {
    out.whenExits = from.whenExits;
  }
  if (["always", "never", "running"].includes(from.askBeforeClosing as string)) {
    out.askBeforeClosing = from.askBeforeClosing;
  }
  return out as Partial<TerminalProfile>;
}

/** A saved Window Group: windows of tabs, each a folder and a profile. */
export interface WindowGroupTab {
  cwd: string;
  profile: string;
}

export interface WindowGroup {
  name: string;
  windows: readonly (readonly WindowGroupTab[])[];
}

export interface TerminalSettings {
  /** On startup: a new window of `startupProfile`, or the Window Group `startupGroup`. */
  startup: "profile" | "group";
  startupProfile: string;
  startupGroup: string;
  defaultProfile: string;
  newWindowProfile: "default" | "same";
  newTabProfile: "default" | "same";
  newWindowFolder: "home" | "same";
  newTabFolder: "home" | "same";
  /** What the person changed of a built-in profile, and each profile of their own whole. */
  changes: Readonly<Record<string, Partial<TerminalProfile>>>;
  /** The names of the profiles of the person's own, which are not built in. */
  own: readonly string[];
  /** The built-in profiles the person took out of the list. */
  removed: readonly string[];
  groups: readonly WindowGroup[];
}

export const DEFAULT_SETTINGS: TerminalSettings = {
  startup: "profile",
  startupProfile: "Basic",
  startupGroup: "",
  defaultProfile: "Basic",
  newWindowProfile: "default",
  newTabProfile: "same",
  newWindowFolder: "same",
  newTabFolder: "same",
  changes: {},
  own: [],
  removed: [],
  groups: [],
};

const isText = (value: unknown): value is string => typeof value === "string";

function readGroups(stored: unknown): readonly WindowGroup[] {
  if (!Array.isArray(stored)) return [];
  return stored.flatMap((group) => {
    if (!isText(group?.name) || !Array.isArray(group?.windows)) return [];
    const windows = (group.windows as unknown[]).map((tabs) =>
      (Array.isArray(tabs) ? tabs : []).filter(
        (tab): tab is WindowGroupTab => isText(tab?.cwd) && isText(tab?.profile),
      ),
    );
    return [{ name: group.name, windows: windows.filter((tabs) => tabs.length > 0) }];
  });
}

/** The settings in `text` as it was kept; whatever is missing or not valid is its default. */
export function readSettings(text: string): TerminalSettings {
  let stored: Record<string, unknown>;
  try {
    stored = JSON.parse(text);
  } catch {
    return DEFAULT_SETTINGS;
  }
  if (typeof stored !== "object" || stored === null) return DEFAULT_SETTINGS;
  const changes = Object.fromEntries(
    Object.entries(
      typeof stored.changes === "object" && stored.changes !== null ? stored.changes : {},
    ).map(([name, each]) => [name, readProfileChanges(each)]),
  );
  const names = (value: unknown) => (Array.isArray(value) ? value.filter(isText) : []);
  return {
    startup: stored.startup === "group" ? "group" : "profile",
    startupProfile: isText(stored.startupProfile) ? stored.startupProfile : "Basic",
    startupGroup: isText(stored.startupGroup) ? stored.startupGroup : "",
    defaultProfile: isText(stored.defaultProfile) ? stored.defaultProfile : "Basic",
    newWindowProfile: stored.newWindowProfile === "same" ? "same" : "default",
    newTabProfile: stored.newTabProfile === "default" ? "default" : "same",
    newWindowFolder: stored.newWindowFolder === "home" ? "home" : "same",
    newTabFolder: stored.newTabFolder === "home" ? "home" : "same",
    changes,
    own: names(stored.own),
    removed: names(stored.removed),
    groups: readGroups(stored.groups),
  };
}

const builtIn = (name: string) => BUILT_IN_PROFILES.find((profile) => profile.name === name);

/** Every profile in the list: the built-in ones left in it, then the person's own. */
export function profileNames(settings: TerminalSettings): string[] {
  return [
    ...BUILT_IN_PROFILES.map((profile) => profile.name).filter(
      (name) => !settings.removed.includes(name),
    ),
    ...settings.own,
  ];
}

/** The profile `name` with the person's changes; Basic when no such profile is left. */
export function profileNamed(settings: TerminalSettings, name: string): TerminalProfile {
  const known = profileNames(settings).includes(name);
  const base = known
    ? (builtIn(name) ?? { ...BASE, name })
    : (BUILT_IN_PROFILES[0] as TerminalProfile);
  const usedName = known ? name : base.name;
  return { ...base, ...settings.changes[usedName], name: usedName };
}

export function changeProfile(
  settings: TerminalSettings,
  name: string,
  change: Partial<TerminalProfile>,
): TerminalSettings {
  return {
    ...settings,
    changes: { ...settings.changes, [name]: { ...settings.changes[name], ...change } },
  };
}

const freeName = (settings: TerminalSettings, wanted: string) => {
  const taken = new Set([...BUILT_IN_PROFILES.map(({ name }) => name), ...settings.own]);
  if (!taken.has(wanted)) return wanted;
  let count = 2;
  while (taken.has(`${wanted} ${count}`)) count += 1;
  return `${wanted} ${count}`;
};

/** Adds a profile of the person's own, and answers its name. */
export function addProfile(
  settings: TerminalSettings,
  wanted: string,
  from: Partial<TerminalProfile> = {},
): { settings: TerminalSettings; name: string } {
  const name = freeName(settings, wanted.trim() || "Untitled");
  return {
    name,
    settings: {
      ...settings,
      own: [...settings.own, name],
      changes: { ...settings.changes, [name]: { ...from, name } },
    },
  };
}

/** A profile takes a new name, everywhere it is named. */
export function renameProfile(
  settings: TerminalSettings,
  name: string,
  wanted: string,
): TerminalSettings {
  const trimmed = wanted.trim();
  if (!trimmed || trimmed === name || builtIn(name)) return settings;
  const next = freeName(settings, trimmed);
  const { [name]: changes, ...others } = settings.changes;
  return {
    ...settings,
    own: settings.own.map((each) => (each === name ? next : each)),
    changes: { ...others, [next]: { ...changes, name: next } },
    defaultProfile: settings.defaultProfile === name ? next : settings.defaultProfile,
    startupProfile: settings.startupProfile === name ? next : settings.startupProfile,
  };
}

/** A profile leaves the list; the default goes to Basic if it was. The last one stays. */
export function removeProfile(settings: TerminalSettings, name: string): TerminalSettings {
  if (profileNames(settings).length <= 1) return settings;
  const { [name]: _gone, ...changes } = settings.changes;
  const own = settings.own.includes(name);
  const next: TerminalSettings = {
    ...settings,
    changes,
    own: settings.own.filter((each) => each !== name),
    removed: own ? settings.removed : [...settings.removed, name],
  };
  const first = profileNames(next)[0] as string;
  return {
    ...next,
    defaultProfile: settings.defaultProfile === name ? first : settings.defaultProfile,
    startupProfile: settings.startupProfile === name ? first : settings.startupProfile,
  };
}

/** The built-in profiles come back as a Mac has them; the person's own stay. */
export function restoreDefaultProfiles(settings: TerminalSettings): TerminalSettings {
  const changes = Object.fromEntries(
    Object.entries(settings.changes).filter(([name]) => settings.own.includes(name)),
  );
  return { ...settings, changes, removed: [] };
}

const escapeXml = (text: string) =>
  text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

/**
 * A profile as a `.terminal` file: a property list, as a Mac's is. Its colours and fonts are plain
 * values here, where a Mac's are archived objects, so a Mac does not read them from this file.
 */
export function profileToFile(profile: TerminalProfile): string {
  const rows = Object.entries({ ...profile, type: "Window Settings" }).flatMap(([key, value]) => {
    if (value === null) return [];
    const shown =
      typeof value === "boolean"
        ? `<${value}/>`
        : typeof value === "number"
          ? `<integer>${value}</integer>`
          : `<string>${escapeXml(value)}</string>`;
    return [`\t<key>${escapeXml(key)}</key>\n\t${shown}`];
  });
  return `<?xml version="1.0" encoding="UTF-8"?>\n<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">\n<plist version="1.0">\n<dict>\n${rows.join("\n")}\n</dict>\n</plist>\n`;
}

/**
 * What of a `.terminal` file this Terminal can use: its name and the values `profileToFile` writes.
 * A Mac's archived colours and fonts are left out. Answers `null` for what is no such file.
 */
export function profileFromFile(text: string): Partial<TerminalProfile> | null {
  const xml = new DOMParser().parseFromString(text, "application/xml");
  const dict = xml.querySelector("plist > dict");
  if (!dict || xml.querySelector("parsererror")) return null;
  const read: Record<string, unknown> = {};
  const parts = [...dict.children];
  for (let at = 0; at + 1 < parts.length; at += 2) {
    const key = parts[at] as Element;
    const value = parts[at + 1] as Element;
    if (key.tagName !== "key") return null;
    const name = key.textContent ?? "";
    if (value.tagName === "true" || value.tagName === "false")
      read[name] = value.tagName === "true";
    else if (value.tagName === "integer") read[name] = Number(value.textContent);
    else if (value.tagName === "string") read[name] = value.textContent ?? "";
  }
  return typeof read.name === "string" ? readProfileChanges(read) : null;
}

/** The custom properties a window sets for `profile`; Basic's come from its tokens. */
export function profileStyle(profile: TerminalProfile): Record<string, string> {
  const style: Record<string, string> = {};
  if (profile.background) style["--_background"] = profile.background;
  if (profile.foreground) style["--_foreground"] = profile.foreground;
  if (profile.bold) style["--_bold"] = profile.bold;
  if (profile.selection) style["--_selection"] = profile.selection;
  if (profile.cursor) style["--_cursor"] = profile.cursor;
  return style;
}

/** The frame that shows `profile`'s columns and rows, as Basic's 80×24 fits 536×334 at 11 pt. */
export function frameOfProfile(profile: TerminalProfile): { width: number; height: number } {
  return {
    width: Math.ceil(profile.columns * profile.fontSize * 0.6) + 8,
    height: profile.rows * Math.ceil(profile.fontSize * 1.18) + 22,
  };
}
