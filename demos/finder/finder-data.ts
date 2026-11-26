/**
 * The Finder demo's file system: a small tree held in memory, and the pure functions that
 * read and change it. Nothing here touches a real disk. Every name is either visible in the
 * reference screenshots or invented for the demo.
 */

import { type FinderCriterion, matchesCriterion } from "./finder-criteria";

/** What an item is, which picks its icon and its Kind text. */
export type FinderKind =
  | "folder"
  | "application"
  | "image"
  | "pdf"
  | "book"
  | "document"
  | "audio"
  | "movie"
  | "file"
  | "volume"
  | "server"
  | "network";

/** The name Finder shows: without its extension when the item asks for that. */
export const displayName = (node: FinderNode): string => {
  if (!node.hideExtension) return node.name;
  const dot = node.name.lastIndexOf(".");
  return dot > 0 ? node.name.slice(0, dot) : node.name;
};

/** The tree with nothing hidden in it: Command-Shift-Period. */
export function withHiddenShown(node: FinderNode): FinderNode {
  const { hidden: _hidden, ...shown } = node;
  return node.children ? { ...shown, children: node.children.map(withHiddenShown) } : shown;
}

/** One item of the tree. An item with `children`, even empty, is a container. */
export interface FinderNode {
  /** The item's name, unique among its siblings. */
  name: string;
  kind: FinderKind;
  /** Size in bytes; containers have none. */
  size?: number;
  /** Last modification, as `YYYY-MM-DD HH:MM` local time. */
  modified?: string;
  /** When the item was last opened, in the same form; shown for pictures. */
  opened?: string;
  /** Names of the item's Finder tags (see `TAGS`). */
  tags?: readonly string[];
  /** What Get Info keeps of an item on the drive. */
  comment?: string;
  /** Cannot be renamed, moved, trashed or saved over. */
  locked?: boolean;
  /** Finder shows the name without its extension. */
  hideExtension?: boolean;
  /** Opening it opens a copy. */
  stationery?: boolean;
  /** Pixel dimensions of a picture, as shown in the Preview pane. */
  dimensions?: string;
  /** Quarter turns applied by Rotate Left. */
  rotation?: number;
  /** A folder shared on the network: Finder shows a “Shared Folder” banner above it. */
  shared?: boolean;
  /** Not listed in its parent (the Library folder, /Volumes); still reachable and searchable. */
  hidden?: boolean;
  /** The items inside. */
  children?: readonly FinderNode[];
  /** A file or folder of the person's drive: its id there (`demos/desktop/desktop-files.ts`). */
  id?: string;
  /** A drive file's media type. */
  type?: string;
  /** When the item was made, in the form of `modified`. */
  created?: string;
  /** The Kind text, when the item's kind alone does not say it (`PNG image`). */
  kindLabel?: string;
  /** A drive item's exact last change (epoch ms): what Quick Look reads its bytes again on. */
  revision?: number;
  /** The root only: the paths Recents lists, most recent first. */
  recents?: readonly string[];
  /** The root only: the bytes still free, which the status bar shows. */
  available?: number;
}

/** An item together with where it is. The path is what selections and histories hold. */
export interface FinderEntry {
  path: string;
  node: FinderNode;
}

/** The four ways a Finder window shows a folder. */
export type FinderView = "icons" | "list" | "columns" | "gallery";

/** The column the items are sorted by, in the shape the library's table views use. */
export interface FinderSort {
  column: string;
  direction: "ascending" | "descending";
  /** Size counts what a folder holds, all the way down: View Options' Calculate all sizes. */
  allSizes?: boolean;
  /** Folders come before files when sorting by name: Preferences' Keep folders on top. */
  foldersFirst?: boolean;
}

export const DEFAULT_SORT: FinderSort = { column: "name", direction: "ascending" };

/** The user's home folder. */
export const HOME = "/Users/shackett";
/** The Trash: a hidden folder of the home folder, as on a Mac. Its window is named “Trash”. */
export const TRASH = `${HOME}/.Trash`;
/** The computer's name, as its row in the sidebar shows it. */
export const COMPUTER_NAME = "ismhpro";

/** Places that are not folders of the tree. */
export const RECENTS = "recents:";
export const AIRDROP = "airdrop:";
export const COMPUTER = "computer:";
export const ALL_TAGS = "tags:";
export const NETWORK = "/Network";

/** The location of the items that carry the tag `name`. */
export const tagLocation = (name: string) => `tag:${name}`;

export type FinderTagColor = "red" | "orange" | "green" | "blue" | "gray" | "none";

/** The Finder tags of the screenshots' sidebar, in its order. Work and Home have no colour. */
export const TAGS: readonly { name: string; color: FinderTagColor }[] = [
  { name: "Blue", color: "blue" },
  { name: "Work", color: "none" },
  { name: "Orange", color: "orange" },
  { name: "Gray", color: "gray" },
  { name: "Green", color: "green" },
  { name: "Home", color: "none" },
  { name: "Red", color: "red" },
];

/** The colour of the first coloured tag of an item, if it has one. */
export function tagColor(node: FinderNode): FinderTagColor | undefined {
  for (const name of node.tags ?? []) {
    const tag = TAGS.find((entry) => entry.name === name);
    if (tag && tag.color !== "none") return tag.color;
  }
  return undefined;
}

const APPLICATIONS = [
  "App Store",
  "Automator",
  "Books",
  "Calculator",
  "Calendar",
  "Chess",
  "Contacts",
  "Dictionary",
  "FaceTime",
  "Find My",
  "Font Book",
  "Home",
  "Image Capture",
  "Launchpad",
  "Mail",
  "Maps",
  "Messages",
  "Mission Control",
  "Music",
  "News",
  "Notes",
  "Photo Booth",
  "Photos",
  "Podcasts",
  "Preview",
  "QuickTime Player",
  "Reminders",
  "Safari",
  "Siri",
  "Stickies",
  "Stocks",
  "System Preferences",
  "TextEdit",
  "Time Machine",
  "TV",
  "Voice Memos",
];

const UTILITIES = [
  "Activity Monitor",
  "AirPort Utility",
  "Audio MIDI Setup",
  "Bluetooth File Exchange",
  "Boot Camp Assistant",
  "ColorSync Utility",
  "Console",
  "Digital Color Meter",
  "Disk Utility",
  "Grapher",
  "Keychain Access",
  "Migration Assistant",
  "Screenshot",
  "Script Editor",
  "System Information",
  "Terminal",
  "VoiceOver Utility",
];

const SERVERS = ["brn30055c475bce", "Castle", "ismhpro", "merribook"];

const folder = (
  name: string,
  children: readonly FinderNode[] = [],
  extra: Partial<FinderNode> = {},
): FinderNode => ({ name, kind: "folder", modified: "2019-10-07 09:41", children, ...extra });

/** An empty folder, as New Folder makes one. */
export const createFolder = (name: string): FinderNode => folder(name);

const application = (name: string, index: number): FinderNode => ({
  name,
  kind: "application",
  size: (3 + ((index * 37) % 90)) * 1_100_000,
  modified: "2019-09-29 18:02",
});

const file = (name: string, kind: FinderKind, size: number, modified: string): FinderNode => ({
  name,
  kind,
  size,
  modified,
});

/** The fourteen pictures of the Downloads folder: the ninth is the one the capture selects. */
const pictures: FinderNode[] = Array.from({ length: 14 }, (_, index) => ({
  name: `10-${index + 1}.jpg`,
  kind: "image" as const,
  size: index === 8 ? 9_400_000 : 2_100_000 + index * 730_000,
  modified:
    index === 8 ? "2018-04-17 22:11" : `2018-04-${String(4 + index).padStart(2, "0")} 20:15`,
  opened: index === 8 ? "2018-05-29 10:33" : `2018-05-${String(2 + index).padStart(2, "0")} 09:12`,
  dimensions: index < 4 ? "2560×1920" : "5120×2880",
}));

/**
 * A new copy of the demo's file system: the startup disk “Macintosh SSD” with Applications,
 * Utilities and the home folder of the screenshots, two more disks and four computers on the
 * network.
 */
export function createFileSystem(): FinderNode {
  const helper = folder("com.apple.AquaAppearanceHelper");
  return {
    name: "Macintosh SSD",
    kind: "volume",
    children: [
      folder("Applications", [
        ...APPLICATIONS.map(application),
        folder("Utilities", UTILITIES.map(application)),
      ]),
      folder("Library", [folder("Caches", [helper])]),
      folder("System", [folder("Library")]),
      folder("Users", [
        folder(
          "shackett",
          [
            folder("Desktop", [
              file("Meeting notes.txt", "document", 2_300, "2019-10-02 14:20"),
              file("Screen sketch.jpg", "image", 1_800_000, "2019-10-05 11:03"),
            ]),
            folder(
              "Documents",
              [
                file("Aqua and Bondi.ibooks", "book", 48_200_000, "2019-06-03 08:30"),
                file("Aqua and Bondi.pdf", "pdf", 31_700_000, "2019-06-03 08:31"),
                file("Aqua_and_Bondi-preview.ibooks", "book", 6_400_000, "2019-05-20 17:45"),
                folder("Letters", [
                  file("To the council.txt", "document", 4_100, "2019-03-11 10:12"),
                ]),
                file("Budget.txt", "document", 12_800, "2019-09-12 16:40"),
              ],
              { tags: ["Green"] },
            ),
            folder("Downloads", pictures, { shared: true }),
            folder("Movies"),
            folder("Music"),
            folder("Pictures", [
              file("Harbour.jpg", "image", 3_300_000, "2019-08-14 19:22"),
              file("Dunes.jpg", "image", 2_900_000, "2019-08-15 07:05"),
            ]),
            folder("Public", [folder("Drop Box")]),
            folder(
              "Library",
              [
                folder("Caches", [helper]),
                folder("iCloud Drive", [
                  folder("Numbers"),
                  folder("Pages"),
                  file("Packing list.txt", "document", 900, "2019-07-15 09:00"),
                ]),
              ],
              { hidden: true },
            ),
            folder(
              ".Trash",
              [
                file("Old packing list.txt", "document", 1_200, "2019-08-30 12:10"),
                file("Blurred.jpg", "image", 2_400_000, "2019-08-14 19:25"),
              ],
              { hidden: true },
            ),
          ],
          { shared: true },
        ),
        folder("Shared"),
      ]),
      folder(
        "Volumes",
        [
          { name: "Macintosh HD", kind: "volume", children: [folder("Archive"), folder("Scans")] },
          { name: "Time Machine", kind: "volume", children: [folder("Backups.backupdb")] },
        ],
        { hidden: true },
      ),
      {
        name: "Network",
        kind: "network",
        hidden: true,
        children: SERVERS.map((name) => ({ name, kind: "server" as const })),
      },
    ],
  };
}

/** The items Recents lists, most recent first. */
const RECENT_PATHS = [
  `${HOME}/Downloads/10-9.jpg`,
  `${HOME}/Documents/Aqua and Bondi.pdf`,
  `${HOME}/Desktop/Screen sketch.jpg`,
  `${HOME}/Documents/Budget.txt`,
  `${HOME}/Pictures/Harbour.jpg`,
];

/** The names along a path: `/Users/shackett` is `["Users", "shackett"]`. */
export const segments = (path: string) => path.split("/").filter(Boolean);

export const joinPath = (parent: string, name: string) =>
  parent === "/" ? `/${name}` : `${parent}/${name}`;

/**
 * The path a text typed into Go to Folder names: `~` is the home folder, a text without a
 * leading slash starts at the folder `from`, and `.` and `..` are followed. A trailing slash
 * does not count.
 */
export function expandPath(text: string, from: string): string {
  const typed = text.trim();
  const full =
    typed === "~" || typed.startsWith("~/")
      ? `${HOME}${typed.slice(1)}`
      : typed.startsWith("/")
        ? typed
        : `${from}/${typed}`;
  const names: string[] = [];
  for (const name of segments(full)) {
    if (name === "..") names.pop();
    else if (name !== ".") names.push(name);
  }
  return `/${names.join("/")}`;
}

/** The folder a path is in; the root is its own parent. */
export function parentPath(path: string): string {
  const names = segments(path);
  return names.length <= 1 ? "/" : `/${names.slice(0, -1).join("/")}`;
}

/** Whether a location is a place computed from the tree rather than a folder of it. */
export const isVirtual = (location: string) => !location.startsWith("/");

/**
 * Whether a location gathers items from all over the tree (Recents, a tag, a search does the
 * same): its list can hold a folder and an item inside it side by side, so it is a flat list
 * whose folders do not expand.
 */
export const gathers = (location: string) => isVirtual(location) && location !== COMPUTER;

/** The item at `path`, if there is one. */
export function resolve(root: FinderNode, path: string): FinderNode | undefined {
  let node: FinderNode | undefined = root;
  for (const name of segments(path)) {
    node = node?.children?.find((child) => child.name === name);
  }
  return path.startsWith("/") ? node : undefined;
}

/** Whether an item opens to show items of its own. */
export const isContainer = (node: FinderNode) => node.children !== undefined;

/** The bytes an item takes: its own size and the sizes of everything inside it. */
export function sizeOf(node: FinderNode): number {
  return (node.children ?? []).reduce((sum, child) => sum + sizeOf(child), node.size ?? 0);
}

/** The address Connect to Server knows a computer of the network by: `smb://castle.local`. */
export const serverAddress = (name: string) => `smb://${name.toLowerCase()}.local`;

/**
 * The computer of the network that an address typed into Connect to Server names, if there is
 * one: the host of the address, with or without a scheme and `.local`, whatever its case.
 */
export function serverAt(root: FinderNode, address: string): FinderEntry | undefined {
  const host = address
    .trim()
    .replace(/^[a-z][a-z0-9+.-]*:\/\//i, "")
    .split("/")[0]
    ?.replace(/\.local$/i, "")
    .toLowerCase();
  if (!host) return undefined;
  const node = resolve(root, NETWORK)?.children?.find(
    (child) => child.kind === "server" && child.name.toLowerCase() === host,
  );
  return node && { path: joinPath(NETWORK, node.name), node };
}

/** Every item under `path`, hidden ones included, parents before their children. */
function walk(node: FinderNode, path: string, into: FinderEntry[]) {
  for (const child of node.children ?? []) {
    const entry = { path: joinPath(path, child.name), node: child };
    into.push(entry);
    walk(child, entry.path, into);
  }
}

const KIND_TEXT: Record<FinderKind, string> = {
  folder: "Folder",
  application: "Application",
  image: "JPEG image",
  pdf: "PDF Document",
  book: "Book",
  document: "Plain Text Document",
  audio: "Audio",
  movie: "Movie",
  file: "Document",
  volume: "Volume",
  server: "Mac",
  network: "Neighborhood",
};

/** The text of Finder's Kind column. */
export const kindText = (node: FinderNode) => node.kindLabel ?? KIND_TEXT[node.kind];

/** A size the way Finder writes it: `9.4 MB`; two dashes for a container. */
export function formatSize(bytes: number | undefined): string {
  if (bytes === undefined) return "--";
  if (bytes < 1000) return `${bytes} bytes`;
  const units = ["KB", "MB", "GB", "TB"];
  let value = bytes / 1000;
  let unit = 0;
  while (value >= 1000 && unit < units.length - 1) {
    value /= 1000;
    unit += 1;
  }
  const digits = value >= 100 || unit === 0 ? 0 : 1;
  return `${value.toFixed(digits).replace(/\.0$/, "")} ${units[unit]}`;
}

const MONTHS = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];

/**
 * A date the way Finder writes it. The stored text is read as it stands, with no time zone,
 * so the server and the browser print the same string.
 *   long    `April 17, 2018 at 10:11 PM`  (Preview pane)
 *   medium  `Apr 17, 2018 at 10:11 PM`    (list view)
 *   short   `4/17/18, 10:11 PM`           (Last opened)
 */
export function formatDate(
  stamp: string | undefined,
  style: "long" | "medium" | "short" = "medium",
): string {
  const match = stamp?.match(/^(\d{4})-(\d{2})-(\d{2}) (\d{2}):(\d{2})$/);
  if (!match) return "--";
  const [year, month, day, hours, minutes] = match.slice(1).map(Number) as [
    number,
    number,
    number,
    number,
    number,
  ];
  const time = `${hours % 12 || 12}:${String(minutes).padStart(2, "0")} ${hours < 12 ? "AM" : "PM"}`;
  if (style === "short") return `${month}/${day}/${String(year).slice(2)}, ${time}`;
  const name = MONTHS[month - 1] ?? "";
  return `${style === "long" ? name : name.slice(0, 3)} ${day}, ${year} at ${time}`;
}

const byName = (a: FinderEntry, b: FinderEntry) =>
  a.node.name.localeCompare(b.node.name, "en", { numeric: true, sensitivity: "base" });

/** The direction Sort By gives a column: the newest and the largest come first. */
export const sortDirection = (column: string): FinderSort["direction"] =>
  column === "modified" || column === "created" || column === "opened" || column === "size"
    ? "descending"
    : "ascending";

/** A date as a list with relative dates shows it: `Today, 3:14 PM`, else as `formatDate` does. */
export function relativeDate(stamp: string | undefined, now: Date): string {
  const long = formatDate(stamp, "short");
  const time = long.split(", ")[1];
  const day = stamp?.slice(0, 10);
  const iso = (date: Date) =>
    `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
  if (time && day === iso(now)) return `Today, ${time}`;
  const yesterday = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1);
  if (time && day === iso(yesterday)) return `Yesterday, ${time}`;
  return formatDate(stamp);
}

/** The entries in the order of `sort`; equal items stay in name order. */
export function sortEntries(entries: readonly FinderEntry[], sort: FinderSort): FinderEntry[] {
  const compare = (a: FinderEntry, b: FinderEntry) => {
    switch (sort.column) {
      case "modified":
        return (a.node.modified ?? "").localeCompare(b.node.modified ?? "");
      case "created":
        return (a.node.created ?? "").localeCompare(b.node.created ?? "");
      case "opened":
        return (a.node.opened ?? "").localeCompare(b.node.opened ?? "");
      case "tags":
        return (a.node.tags?.[0] ?? "\uffff").localeCompare(b.node.tags?.[0] ?? "\uffff");
      case "comments":
        return (a.node.comment ?? "\uffff").localeCompare(b.node.comment ?? "\uffff");
      case "size": {
        const size = ({ node }: FinderEntry) =>
          sort.allSizes && node.children ? sizeOf(node) : (node.size ?? -1);
        return size(a) - size(b);
      }
      case "kind":
        return kindText(a.node).localeCompare(kindText(b.node));
      default:
        return 0;
    }
  };
  const sign = sort.direction === "descending" ? -1 : 1;
  const onTop = sort.foldersFirst && sort.column === "name";
  return [...entries].sort((a, b) => {
    if (onTop) {
      const folders = Number(Boolean(b.node.children)) - Number(Boolean(a.node.children));
      if (folders !== 0) return folders;
    }
    return sign * (compare(a, b) || byName(a, b));
  });
}

/** The visible items of the folder at `path`, unsorted. */
function childrenOf(root: FinderNode, path: string): FinderEntry[] {
  return (resolve(root, path)?.children ?? [])
    .filter((child) => !child.hidden)
    .map((node) => ({ path: joinPath(path, node.name), node }));
}

/** Every item of the tree, for the places that gather items from all over it. */
function everything(root: FinderNode): FinderEntry[] {
  const all: FinderEntry[] = [];
  walk(root, "/", all);
  return all;
}

/**
 * What a location shows: the items of a folder, or those a place gathers (Recents, a tag, the
 * computer's disks). Recents keeps its own order, most recent first, while sorted by name.
 */
export function listing(
  root: FinderNode,
  location: string,
  sort: FinderSort = DEFAULT_SORT,
): FinderEntry[] {
  if (location === RECENTS) {
    const recent = (root.recents ?? RECENT_PATHS).flatMap((path) => {
      const node = resolve(root, path);
      return node ? [{ path, node }] : [];
    });
    return sort.column === "name" && sort.direction === "ascending"
      ? recent
      : sortEntries(recent, sort);
  }
  if (location === AIRDROP) return [];
  if (location === COMPUTER) {
    return sortEntries(
      [
        { path: "/", node: root },
        ...childrenOf(root, "/Volumes"),
        ...(resolve(root, NETWORK)
          ? [{ path: NETWORK, node: resolve(root, NETWORK) as FinderNode }]
          : []),
      ],
      sort,
    );
  }
  if (location === ALL_TAGS) {
    return sortEntries(
      everything(root).filter((entry) => (entry.node.tags?.length ?? 0) > 0),
      sort,
    );
  }
  if (location.startsWith("tag:")) {
    const name = location.slice(4);
    return sortEntries(
      everything(root).filter((entry) => entry.node.tags?.includes(name)),
      sort,
    );
  }
  return sortEntries(childrenOf(root, location), sort);
}

/**
 * The column path that shows the item at `path` in the column view of `location`: the item of
 * the first column it is, or is inside, then each folder down to it. Empty when the location
 * does not hold the item.
 */
export function columnPath(root: FinderNode, location: string, path: string | undefined): string[] {
  if (path === undefined || !resolve(root, path)) return [];
  // The item of the first column that holds the path; the disk itself holds every path, so
  // the longest match is the one (a second disk, not the startup disk it is mounted on).
  const holds = (folder: string) =>
    path === folder || path.startsWith(folder === "/" ? "/" : `${folder}/`);
  const top = listing(root, location)
    .filter((entry) => holds(entry.path))
    .sort((a, b) => b.path.length - a.path.length)[0];
  if (!top) return [];
  const chain = [top.path];
  for (const name of segments(path.slice(top.path.length))) {
    chain.push(joinPath(chain.at(-1) as string, name));
  }
  return chain;
}

/** The name a location goes by: its window title, its tab and its last path component. */
export function locationName(root: FinderNode, location: string): string {
  if (location === RECENTS) return "Recents";
  if (location === AIRDROP) return "AirDrop";
  if (location === COMPUTER) return COMPUTER_NAME;
  if (location === ALL_TAGS) return "All Tags";
  if (location === TRASH) return "Trash";
  if (location.startsWith("tag:")) return location.slice(4);
  return resolve(root, location)?.name ?? segments(location).at(-1) ?? "";
}

/** The folders from the disk down to `path`, the disk first: what the path bar shows. */
export function ancestry(root: FinderNode, path: string): FinderEntry[] {
  if (isVirtual(path)) return [];
  const trail: FinderEntry[] = [{ path: "/", node: root }];
  let current = "/";
  for (const name of segments(path)) {
    current = joinPath(current, name);
    const node = resolve(root, current);
    if (!node) break;
    trail.push({ path: current, node });
  }
  return trail;
}

/**
 * The items under `scope` whose name contains `query` and that answer every one of `rows`, without
 * regard to case, in name order. An item the server found for `query` by its words or tags (a drive
 * id in `contentHits`) counts as holding it; `rowHits` are its ids for the rows' Contents. Hidden
 * folders are searched too, as Spotlight finds a cache folder, but not the Trash unless the search is
 * in it. An empty query with no rows finds nothing.
 */
export function search(
  root: FinderNode,
  scope: string,
  query: string,
  rows: readonly FinderCriterion[] = [],
  contentHits?: ReadonlySet<string>,
  rowHits?: ReadonlySet<string>,
  now: Date = new Date(),
): FinderEntry[] {
  const needle = query.trim().toLowerCase();
  const start = resolve(root, scope);
  if ((needle === "" && rows.length === 0) || !start) return [];
  const all: FinderEntry[] = [];
  walk(start, scope, all);
  const inTrash = (path: string) => path === TRASH || path.startsWith(`${TRASH}/`);
  return all
    .filter(({ node, path }) => {
      if (inTrash(path) && !inTrash(scope)) return false;
      const holdsQuery =
        node.name.toLowerCase().includes(needle) ||
        (node.id !== undefined && contentHits?.has(node.id) === true);
      return holdsQuery && rows.every((row) => matchesCriterion(node, row, rowHits, now));
    })
    .sort(byName);
}

/** A copy of the tree in which the item at `path` is replaced by `change(item)`, or removed. */
function update(
  node: FinderNode,
  names: readonly string[],
  change: (node: FinderNode) => FinderNode | undefined,
): FinderNode | undefined {
  const [name, ...rest] = names;
  if (name === undefined) return change(node);
  if (!node.children?.some((child) => child.name === name)) return node;
  return {
    ...node,
    children: node.children.flatMap((child) => {
      if (child.name !== name) return [child];
      const next = update(child, rest, change);
      return next ? [next] : [];
    }),
  };
}

/** A copy of the tree with the item at `path` changed. An unknown path changes nothing. */
export function changeNode(
  root: FinderNode,
  path: string,
  change: (node: FinderNode) => FinderNode,
): FinderNode {
  return update(root, segments(path), change) ?? root;
}

/** A copy of the tree without the item at `path`. The root cannot be removed. */
export function removeNode(root: FinderNode, path: string): FinderNode {
  if (segments(path).length === 0) return root;
  return update(root, segments(path), () => undefined) ?? root;
}

/** A copy of the tree with `node` added to the folder at `parent`. */
export function addNode(root: FinderNode, parent: string, node: FinderNode): FinderNode {
  return changeNode(root, parent, (target) =>
    target.children ? { ...target, children: [...target.children, node] } : target,
  );
}

/** A name no item of the folder at `parent` has yet: `untitled folder`, `untitled folder 2`. */
export function availableName(root: FinderNode, parent: string, base: string): string {
  const taken = new Set(resolve(root, parent)?.children?.map((child) => child.name));
  if (!taken.has(base)) return base;
  let count = 2;
  while (taken.has(`${base} ${count}`)) count += 1;
  return `${base} ${count}`;
}

/**
 * The name of a copy that is kept beside the names `taken`: with `word` the item's name and
 * that word (`Budget copy.txt`, then `Budget copy 2.txt`), without it the name and a number
 * (`Budget 2.txt`). The number goes before a file's extension.
 */
export function duplicateName(taken: ReadonlySet<string>, node: FinderNode, word = ""): string {
  const dot = isContainer(node) ? -1 : node.name.lastIndexOf(".");
  const stem = `${dot > 0 ? node.name.slice(0, dot) : node.name}${word}`;
  const extension = dot > 0 ? node.name.slice(dot) : "";
  if (word !== "" && !taken.has(`${stem}${extension}`)) return `${stem}${extension}`;
  let count = 2;
  while (taken.has(`${stem} ${count}${extension}`)) count += 1;
  return `${stem} ${count}${extension}`;
}

/**
 * How many items are in a location and what the status bar says about them. `available` is the
 * bytes free; the screenshots' disk has 212.4 GB.
 */
export function statusText(count: number, selected: number, available?: number): string {
  const items = `${count} ${count === 1 ? "item" : "items"}`;
  const free = `${available === undefined ? "212.4 GB" : formatSize(available)} available`;
  return selected > 0 ? `${selected} of ${count} selected, ${free}` : `${items}, ${free}`;
}
