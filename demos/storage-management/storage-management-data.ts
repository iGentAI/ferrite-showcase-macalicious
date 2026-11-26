/** A file a category lists. */
export interface StorageFile {
  /** Identifies the file within its category. */
  id: string;
  /** The file's name. */
  name: string;
  /** What kind of file it is. */
  kind: string;
  /**
   * When it was last opened: an ISO date, `YYYY-MM-DD`, or that date with a time after it
   * (`YYYY-MM-DDTHH:MM`, with optional seconds and time zone), of which the date is shown.
   * Anything else, and a day the calendar does not have, is shown as "--".
   */
  lastAccessed: string;
  /** Its size in bytes. */
  size: number;
}

/** A row of the sidebar under Recommendations. Sizes are bytes; a gigabyte is 1000³. */
export interface StorageCategory {
  /** Identifies the category: the `selectedId` that shows it. */
  id: string;
  /** Its name. */
  name: string;
  /**
   * What it takes on the disk. It is taken to be at least the sum of its files, and shrinks
   * as files are deleted, unless `exactSize` is set.
   */
  size: number;
  /**
   * Whether `size` is exact as given, whatever its files add up to: for a host that counts
   * shared content once (two copies of one file take its space once), so a category can take
   * less than its files. Deleting a file then leaves the size to the host's next report.
   */
  exactSize?: boolean;
  /**
   * Whether its size takes disk space of its own (the default). A category that only gathers
   * files the others already count (Large Files), or what is kept outside the disk, sets it to
   * `false`: the used and free space leave it out, so deleting from it frees nothing twice.
   */
  onDisk?: boolean;
  /** The files it lists. A category may take more than its files: not everything is listed. */
  files?: readonly StorageFile[];
  /** A line above the files that says what the category holds. */
  description?: string;
  /**
   * `false` for a category that cannot be opened: it is dimmed, listed after the others and
   * never selected, as System and Other are.
   */
  selectable?: boolean;
  /** `true` for a category that only reports: its files cannot be deleted or shown in Finder. */
  readOnly?: boolean;
}

/** The four recommendations, by id. */
export type StorageRecommendationId =
  | "icloud"
  | "optimize"
  | "trash"
  | "auto-trash"
  | "large"
  | "clutter";

/** A row of the Recommendations pane. */
export interface StorageRecommendation {
  /** Identifies the recommendation: what `onRecommendation` is called with. */
  id: StorageRecommendationId;
  /** The bold title. */
  title: string;
  /** The text under it. */
  description: string;
  /** The title of its button. Without one the row only states something. */
  action?: string;
  /**
   * The category its button opens. Without it the button carries the recommendation out and
   * the row then says "Completed".
   */
  reviews?: string;
  /** `true` for a button that stays after it is pressed: a setting the host follows. */
  stays?: boolean;
}

/** The four recommendations of the capture, top to bottom. */
export const RECOMMENDATIONS: readonly StorageRecommendation[] = [
  {
    id: "icloud",
    title: "Store in iCloud",
    description:
      "Store all files, photos, and messages in iCloud and save space by keeping only recent files and optimized photos on this Mac when storage space is needed.",
    action: "Store in iCloud…",
  },
  {
    id: "optimize",
    title: "Optimize Storage",
    description:
      "Save space by automatically removing movies and TV shows that you’ve already watched from this Mac.",
    action: "Optimize…",
  },
  {
    id: "trash",
    title: "Empty Trash Automatically",
    description:
      "Save space by automatically erasing items that have been in the Trash for more than 30 days.",
    action: "Turn On…",
  },
  {
    id: "clutter",
    title: "Reduce Clutter",
    description:
      "Sort through documents and other content stored on this Mac and delete what is no longer needed.",
    action: "Review Files",
    reviews: "documents",
  },
];

/** The `selectedId` of the first row of the sidebar. */
export const RECOMMENDATIONS_ID = "recommendations";

const KB = 1e3;
const MB = 1e6;
const GB = 1e9;

/** The disk of both captures. */
export const defaultCapacity = 249.85 * GB;
/** What is free in the light capture. */
export const defaultAvailable = 195.81 * GB;
/** What is free in the dark capture. */
export const darkCaptureAvailable = 193.78 * GB;

/* The files are invented: no capture shows a category's list. */
const documents: StorageCategory = {
  id: "documents",
  name: "Documents",
  size: 6.92 * GB,
  description: "Sort through documents and permanently erase files you no longer need.",
  files: [
    {
      id: "rehearsal",
      name: "Keynote Rehearsal.mov",
      kind: "QuickTime movie",
      lastAccessed: "2019-09-12",
      size: 2.31 * GB,
    },
    {
      id: "archive",
      name: "Family Archive.zip",
      kind: "ZIP archive",
      lastAccessed: "2018-12-27",
      size: 1.48 * GB,
    },
    {
      id: "backup",
      name: "Project Backup.dmg",
      kind: "Disk Image",
      lastAccessed: "2019-03-04",
      size: 1.12 * GB,
    },
    {
      id: "report",
      name: "Annual Report 2019.key",
      kind: "Keynote presentation",
      lastAccessed: "2019-10-01",
      size: 684.2 * MB,
    },
    {
      id: "survey",
      name: "Site Survey.pdf",
      kind: "PDF document",
      lastAccessed: "2019-08-19",
      size: 412.6 * MB,
    },
    {
      id: "forecast",
      name: "Budget Forecast.numbers",
      kind: "Numbers spreadsheet",
      lastAccessed: "2019-09-30",
      size: 96.4 * MB,
    },
    {
      id: "thesis",
      name: "Thesis Draft.pages",
      kind: "Pages document",
      lastAccessed: "2019-06-02",
      size: 38.7 * MB,
    },
    {
      id: "notes",
      name: "Meeting Notes.rtf",
      kind: "Rich Text Document",
      lastAccessed: "2019-10-03",
      size: 212 * KB,
    },
  ],
};

const iCloudDrive: StorageCategory = {
  id: "icloud-drive",
  name: "iCloud Drive",
  size: 3.6 * MB,
  description: "Files kept on this Mac from iCloud Drive.",
  files: [
    {
      id: "itinerary",
      name: "Travel Itinerary.pdf",
      kind: "PDF document",
      lastAccessed: "2019-09-21",
      size: 2.1 * MB,
    },
    {
      id: "recipes",
      name: "Recipes.pages",
      kind: "Pages document",
      lastAccessed: "2019-07-14",
      size: 1.2 * MB,
    },
  ],
};

const music: StorageCategory = {
  id: "music",
  name: "Music",
  size: 58.4 * MB,
  description: "Songs and recordings stored on this Mac.",
  files: [
    {
      id: "demo",
      name: "Demo Take 3.m4a",
      kind: "Apple MPEG-4 audio",
      lastAccessed: "2019-05-09",
      size: 21.6 * MB,
    },
    {
      id: "rehearsal",
      name: "Rehearsal.m4a",
      kind: "Apple MPEG-4 audio",
      lastAccessed: "2019-02-18",
      size: 8.4 * MB,
    },
    {
      id: "chime",
      name: "Door Chime.aiff",
      kind: "AIFF-C audio",
      lastAccessed: "2018-11-30",
      size: 1.3 * MB,
    },
  ],
};

const photos: StorageCategory = {
  id: "photos",
  name: "Photos",
  size: 256.3 * MB,
  description: "Photo libraries stored on this Mac.",
  files: [
    {
      id: "library",
      name: "Photos Library.photoslibrary",
      kind: "Photos Library",
      lastAccessed: "2019-10-02",
      size: 248.9 * MB,
    },
  ],
};

const podcasts: StorageCategory = {
  id: "podcasts",
  name: "Podcasts",
  size: 117.5 * MB,
  description: "Episodes downloaded to this Mac.",
  files: [
    {
      id: "episode-41",
      name: "Episode 41.mp3",
      kind: "MP3 audio",
      lastAccessed: "2019-10-03",
      size: 62.3 * MB,
    },
    {
      id: "episode-40",
      name: "Episode 40.mp3",
      kind: "MP3 audio",
      lastAccessed: "2019-09-26",
      size: 48.1 * MB,
    },
  ],
};

const trash: StorageCategory = {
  id: "trash",
  name: "Trash",
  size: 11.7 * MB,
  description: "Items in the Trash still take space until they are erased.",
  files: [
    {
      id: "screenshot",
      name: "Old Screenshot.png",
      kind: "PNG image",
      lastAccessed: "2019-09-02",
      size: 6.2 * MB,
    },
    {
      id: "draft",
      name: "Draft.docx",
      kind: "Word document",
      lastAccessed: "2019-08-11",
      size: 5.1 * MB,
    },
  ],
};

const tv: StorageCategory = {
  id: "tv",
  name: "TV",
  size: 6 * GB,
  description: "Movies and TV shows downloaded to this Mac.",
  files: [
    {
      id: "documentary",
      name: "Documentary (1080p).m4v",
      kind: "MPEG-4 movie",
      lastAccessed: "2019-09-28",
      size: 3.42 * GB,
    },
    {
      id: "pilot",
      name: "Pilot Episode.m4v",
      kind: "MPEG-4 movie",
      lastAccessed: "2019-07-06",
      size: 1.87 * GB,
    },
    {
      id: "trailer",
      name: "Trailer.mov",
      kind: "QuickTime movie",
      lastAccessed: "2019-04-22",
      size: 412.5 * MB,
    },
  ],
};

/** The sidebar of the light capture: five categories, then System and Other. */
export const defaultCategories: readonly StorageCategory[] = [
  documents,
  iCloudDrive,
  music,
  photos,
  tv,
  { id: "system", name: "System", size: 16.36 * GB, selectable: false },
  { id: "other", name: "Other", size: 6.32 * GB, selectable: false },
];

/** The sidebar of the dark capture: Podcasts and Trash as well, and Other alone at the end. */
export const darkCaptureCategories: readonly StorageCategory[] = [
  documents,
  iCloudDrive,
  music,
  photos,
  podcasts,
  trash,
  tv,
  { id: "other", name: "Other", size: 12.45 * GB, selectable: false },
];

const UNITS = [
  ["KB", 1e3, 0],
  ["MB", 1e6, 1],
  ["GB", 1e9, 2],
  ["TB", 1e12, 2],
] as const;

/** A size that can be counted: nothing for a negative one or a value that is not a number. */
const amount = (value: number) => (Number.isFinite(value) && value > 0 ? value : 0);

/** What files take together; a size that cannot be counted adds nothing. */
export const filesSize = (files: readonly StorageFile[]) =>
  files.reduce((sum, file) => sum + amount(file.size), 0);

/**
 * A size as macOS writes it: decimal units, two decimals from a gigabyte up, one for megabytes
 * and none below, without trailing zeros ("249.85 GB", "3.6 MB", "6 GB"). Nothing, a negative
 * size and a value that is not a number are "Zero KB".
 */
export function formatSize(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes < 0.5) return "Zero KB";
  if (bytes < 999.5) return `${Math.round(bytes)} bytes`;
  for (const [unit, scale, decimals] of UNITS) {
    const value = Number((bytes / scale).toFixed(decimals));
    // A value that rounds up to a thousand is written in the next unit: "1 GB", not "1000 MB".
    if (value < 1000 || unit === "TB") return `${value} ${unit}`;
  }
  return "Zero KB";
}

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

/** The number of days in a month of the Gregorian calendar; `month` counts from 1. */
function daysIn(year: number, month: number): number {
  if (month === 2) return (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0 ? 29 : 28;
  return month === 4 || month === 6 || month === 9 || month === 11 ? 30 : 31;
}

/* The whole of a date: `YYYY-MM-DD`, alone or before `T` and a time of day. */
const DATE =
  /^(\d{4})-(\d{2})-(\d{2})(?:T(?:[01]\d|2[0-3]):[0-5]\d(?::[0-5]\d(?:\.\d+)?)?(?:Z|[+-]\d{2}:\d{2})?)?$/;

/** The day an ISO date names, as a number that orders days, or `undefined` when it names none. */
function day(date: string): number | undefined {
  const match = DATE.exec(date);
  if (!match) return undefined;
  const [year, month, dayOfMonth] = match.slice(1).map(Number) as [number, number, number];
  if (month < 1 || month > 12 || dayOfMonth < 1 || dayOfMonth > daysIn(year, month))
    return undefined;
  return year * 10000 + month * 100 + dayOfMonth;
}

/** A date as the Last Accessed column writes it: "Oct 3, 2019", or "--" for no date. */
export function formatDate(date: string): string {
  const value = day(date);
  if (value === undefined) return "--";
  const month = MONTHS[(Math.floor(value / 100) % 100) - 1];
  return `${month} ${value % 100}, ${Math.floor(value / 10000)}`;
}

/** The columns of a category's table. */
export const COLUMNS = [
  { id: "name", title: "Name" },
  { id: "kind", title: "Kind", width: 150 },
  { id: "lastAccessed", title: "Last Accessed", width: 110 },
  { id: "size", title: "Size", width: 84, align: "right" },
] as const;

/** The id of a column. */
export type StorageColumnId = (typeof COLUMNS)[number]["id"];

/** The column the files are ordered by, and the direction. */
export interface StorageSort {
  /** A column's id. An id that names no column orders by name. */
  column: string;
  /** Smallest, earliest or first in the alphabet at the top, or the other way round. */
  direction: "ascending" | "descending";
}

/** The order a category opens in: the largest file first. */
export const defaultSort: StorageSort = { column: "size", direction: "descending" };

const byName = (a: StorageFile, b: StorageFile) =>
  a.name.localeCompare(b.name, "en", { numeric: true, sensitivity: "base" });

/**
 * The files in the order of a column: names and kinds as text, dates by day and sizes as
 * numbers. A file without a date comes after every dated one, in either direction, and files
 * that are equal in the column are ordered by name. The array given is not changed.
 */
export function sortFiles(files: readonly StorageFile[], sort: StorageSort): StorageFile[] {
  const sign = sort.direction === "descending" ? -1 : 1;
  const compare = (a: StorageFile, b: StorageFile): number => {
    if (sort.column === "size") return sign * (amount(a.size) - amount(b.size));
    if (sort.column === "kind") {
      return sign * a.kind.localeCompare(b.kind, "en", { sensitivity: "base" });
    }
    if (sort.column === "lastAccessed") {
      const [first, second] = [day(a.lastAccessed), day(b.lastAccessed)];
      if (first === undefined || second === undefined) {
        return first === second ? 0 : first === undefined ? 1 : -1;
      }
      return sign * (first - second);
    }
    return sign * byName(a, b);
  };
  return [...files].sort((a, b) => compare(a, b) || byName(a, b));
}

/** What a category takes: its size, or the sum of its files when that is more (unless its size
 * is exact). */
export function categorySize(category: StorageCategory): number {
  if (category.exactSize) return amount(category.size);
  return Math.max(amount(category.size), filesSize(category.files ?? []));
}

/** Whether a category can be opened. */
export const isSelectable = (category: StorageCategory) => category.selectable !== false;

/**
 * The categories the sidebar lists: each id once, the first that uses it, and none under the
 * id of the Recommendations row.
 */
export function listCategories(categories: readonly StorageCategory[]): StorageCategory[] {
  const seen = new Set<string>([RECOMMENDATIONS_ID]);
  return categories.filter((category) => {
    if (seen.has(category.id)) return false;
    seen.add(category.id);
    return true;
  });
}

/**
 * The category without one of its files, and smaller by that file's size. A file the category
 * does not list leaves it as it is.
 */
export function deleteFile(category: StorageCategory, fileId: string): StorageCategory {
  const file = category.files?.find((candidate) => candidate.id === fileId);
  if (!file || !category.files) return category;
  return {
    ...category,
    size: category.exactSize
      ? category.size
      : Math.max(0, categorySize(category) - amount(file.size)),
    files: category.files.filter((candidate) => candidate !== file),
  };
}

/** What all categories that take disk space of their own take together. */
export const usedSize = (categories: readonly StorageCategory[]) =>
  categories
    .filter((category) => category.onDisk !== false)
    .reduce((sum, category) => sum + categorySize(category), 0);

/**
 * What is free after files were deleted: the free space before, and what the categories take
 * less than they did, never more than the disk holds.
 */
export function availableSize(
  available: number,
  capacity: number,
  before: readonly StorageCategory[],
  after: readonly StorageCategory[],
): number {
  const freed = Math.max(0, usedSize(before) - usedSize(after));
  return Math.min(amount(available) + freed, amount(capacity));
}

/** The window's title: "Macintosh SSD - 195.81 GB available of 249.85 GB". */
export function windowTitle(diskName: string, available: number, capacity: number): string {
  const space = `${formatSize(available)} available of ${formatSize(capacity)}`;
  return diskName ? `${diskName} - ${space}` : space;
}

/**
 * The row of the sidebar an id selects: the id itself when it is Recommendations or names a
 * category that can be opened, and Recommendations for any other.
 */
export function resolveSelection(
  categories: readonly StorageCategory[],
  id: string | null | undefined,
): string {
  return categories.some((category) => category.id === id && isSelectable(category))
    ? (id as string)
    : RECOMMENDATIONS_ID;
}
