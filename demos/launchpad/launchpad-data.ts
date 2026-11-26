/**
 * What the demo's Launchpad holds: names only. The applications' icons are Apple's artwork and
 * are not part of the library, so an application is drawn as an abstract placeholder, a
 * rounded square in the tint of its category with its initial.
 */

/** What kind of application it is. It chooses the placeholder's tint and nothing else. */
export type LaunchpadCategory =
  | "internet"
  | "productivity"
  | "media"
  | "creativity"
  | "system"
  | "utilities"
  | "files";

/** One application. */
export interface LaunchpadApp {
  /** Identifies the application: its name in lower case, words joined by hyphens. */
  id: string;
  /** The name under the icon, which the search field matches. */
  name: string;
  /** Chooses the placeholder's tint. */
  category: LaunchpadCategory;
}

/** A folder of applications. */
export interface LaunchpadGroup {
  /** Identifies the folder among the entries. */
  id: string;
  /** The name under the tile and above the open panel. */
  name: string;
  /** The applications in the folder, in order. */
  apps: readonly LaunchpadApp[];
}

/** One place in the grid: an application or a folder. */
export type LaunchpadEntry = LaunchpadApp | LaunchpadGroup;

/** The grid of a 1680 by 1050 point screen: 7 columns by 5 rows. */
export const COLUMNS = 7;
export const ROWS = 5;

const app = (name: string, category: LaunchpadCategory): LaunchpadApp => ({
  id: name.toLowerCase().replace(/\s+/g, "-"),
  name,
  category,
});

/**
 * The folder "Other" of the Launchpad-Folder captures: 17 applications in three rows of the
 * panel (reference/spec/apps/launchpad.md).
 */
export const otherFolder: LaunchpadGroup = {
  id: "other",
  name: "Other",
  apps: [
    app("Grapher", "utilities"),
    app("VoiceOver Utility", "utilities"),
    app("AirPort Utility", "utilities"),
    app("Migration Assistant", "utilities"),
    app("Terminal", "utilities"),
    app("Activity Monitor", "utilities"),
    app("Console", "utilities"),
    app("Keychain Access", "utilities"),
    app("System Information", "utilities"),
    app("Script Editor", "utilities"),
    app("Disk Utility", "utilities"),
    app("Boot Camp Assistant", "utilities"),
    app("Digital Color Meter", "utilities"),
    app("ColorSync Utility", "utilities"),
    app("Screenshot", "utilities"),
    app("Bluetooth File Exchange", "utilities"),
    app("Audio MIDI Setup", "utilities"),
  ],
};

/** Page 1 of the Launchpad captures: 35 entries, row by row; the 28th is the folder. */
export const pageOne: readonly LaunchpadEntry[] = [
  app("App Store", "system"),
  app("Safari", "internet"),
  app("Mail", "internet"),
  app("Contacts", "productivity"),
  app("Calendar", "productivity"),
  app("Reminders", "productivity"),
  app("Notes", "productivity"),

  app("FaceTime", "internet"),
  app("Messages", "internet"),
  app("Maps", "internet"),
  app("Find My", "internet"),
  app("Photo Booth", "creativity"),
  app("Photos", "creativity"),
  app("Preview", "creativity"),

  app("Music", "media"),
  app("Podcasts", "media"),
  app("TV", "media"),
  app("Voice Memos", "media"),
  app("News", "media"),
  app("Stocks", "productivity"),
  app("Books", "media"),

  app("Dictionary", "productivity"),
  app("Calculator", "productivity"),
  app("Home", "productivity"),
  app("Siri", "system"),
  app("Mission Control", "system"),
  app("System Preferences", "system"),
  otherFolder,

  app("QuickTime Player", "media"),
  app("TextEdit", "productivity"),
  app("Time Machine", "system"),
  app("Font Book", "creativity"),
  app("Chess", "media"),
  app("Stickies", "productivity"),
  app("Image Capture", "creativity"),
];

/**
 * A second page. The captures show that there is one (two page dots) and not what is on it:
 * these six names are the demo's choice.
 */
export const pageTwo: readonly LaunchpadEntry[] = [
  app("Automator", "utilities"),
  app("Pages", "productivity"),
  app("Numbers", "productivity"),
  app("Keynote", "productivity"),
  app("GarageBand", "creativity"),
  app("iMovie", "creativity"),
];

/** Everything in Launchpad, in order: page 1 as captured, then the second page. */
export const defaultEntries: readonly LaunchpadEntry[] = [...pageOne, ...pageTwo];

/** Whether an entry is a folder. */
export const isGroup = (entry: LaunchpadEntry): entry is LaunchpadGroup => "apps" in entry;

/** Every application of the entries in order, a folder's in its place. */
export const applicationsOf = (entries: readonly LaunchpadEntry[]): LaunchpadApp[] =>
  entries.flatMap((entry) => (isGroup(entry) ? entry.apps : [entry]));

/** How many pages the entries fill; an empty Launchpad still has one. */
export const pageCountOf = (entries: readonly LaunchpadEntry[], perPage = COLUMNS * ROWS) =>
  Math.max(1, Math.ceil(entries.length / Math.max(1, perPage)));

/** The letter on an application's placeholder: the first of its name, as a capital. */
export const initialOf = (name: string) => name.trim().charAt(0).toUpperCase();

/** Finder: always running, first in the Dock, and not in Launchpad. */
export const finder: LaunchpadApp = { id: "finder", name: "Finder", category: "system" };

const named = (name: string): LaunchpadApp => {
  const found = applicationsOf(pageOne).find((candidate) => candidate.name === name);
  if (!found) throw new Error(`"${name}" is not on page 1`);
  return found;
};

/**
 * The applications kept in the Dock of the captures between Launchpad's own tile and the
 * separator, in their order. Each is also on page 1.
 */
export const dockApps: readonly LaunchpadApp[] = [
  "Safari",
  "Mail",
  "FaceTime",
  "Messages",
  "Maps",
  "Photos",
  "Contacts",
  "Calendar",
  "Reminders",
  "Notes",
  "Music",
  "Podcasts",
  "TV",
  "News",
  "App Store",
  "System Preferences",
].map(named);
