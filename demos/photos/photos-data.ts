/*
 * The library of the Photos demo: what a picture is, the sources of the sidebar, and the
 * functions that list, count and date what a source shows. Nothing here is Apple's: the
 * pictures are original generated photographs (photos-artwork.tsx), still named after the
 * shape of the grey placeholder they fall back to.
 */

/** What a library item is. */
export type PhotoKind = "photo" | "video";

/** The simple shape a placeholder picture shows; its title is the shape and a number. */
export type PhotoShape = "disc" | "bands" | "triangle" | "ring" | "diagonal" | "squares";

/** One item of the library. */
export interface Photo {
  /** Identifies the item: what the selection holds. */
  id: string;
  /** The item's name: what its thumbnail is called and what a search matches first. */
  title: string;
  /** The day it was taken, as `yyyy-mm-dd`. */
  date: string;
  /** Width in pixels: with `height`, the shape of the thumbnail. */
  width: number;
  /** Height in pixels. */
  height: number;
  /** A photo or a video. */
  kind: PhotoKind;
  /** What the placeholder picture shows. */
  shape: PhotoShape;
  /** Words a search matches besides the title. */
  keywords: readonly string[];
  /** The albums and projects the item is in, by the `id` of their source. */
  albums: readonly string[];
  /** Whether it came with the latest import. */
  imported?: boolean;
  /** Whether it is a favorite when the window opens. */
  favorite?: boolean;
  /** A video's length, as shown on its thumbnail. */
  duration?: string;
}

/** A choice of the "Showing" menu. */
export type PhotosFilter = "all" | "favorites" | "edited" | "photos" | "videos";

/** The "Showing" menu, in its order, with what an empty list says under each choice. */
export const FILTERS: readonly { id: PhotosFilter; title: string; empty: string }[] = [
  { id: "all", title: "All Items", empty: "No Photos" },
  { id: "favorites", title: "Favorites", empty: "No Favorites" },
  { id: "edited", title: "Edited", empty: "No Edited Photos" },
  { id: "photos", title: "Photos", empty: "No Photos" },
  { id: "videos", title: "Videos", empty: "No Videos" },
];

/** A row of the sidebar. */
export type PhotosSourceId =
  | "photos"
  | "memories"
  | "people"
  | "places"
  | "recents"
  | "imports"
  | "activity"
  | "my-albums"
  | "wallpapers"
  | "my-projects"
  | "wallpaper-book";

/** The drawing of a sidebar row: a template glyph, or the album's own thumbnail. */
export type PhotosSourceIcon =
  | "gear"
  | "photos"
  | "memories"
  | "people"
  | "places"
  | "recents"
  | "imports"
  | "activity"
  | "stack"
  | "thumbnail";

/**
 * What a sidebar row shows in the window: a `collection` is a header over a grid of
 * pictures, a `folder` the albums or projects inside it, `memories` the album that was last
 * shown as a memory, and `empty` a pane that says it has nothing.
 */
export interface PhotosSource {
  id: PhotosSourceId;
  /** The row's label, and the header over its pictures. */
  name: string;
  icon: PhotosSourceIcon;
  kind: "collection" | "folder" | "memories" | "empty";
  /** The folder the row is inside: Back goes there, and the toolbar's title names it. */
  parent?: PhotosSourceId;
  /** An album: its header offers "Show as Memory" and "Slideshow". */
  album?: boolean;
  /** What the pane says while the source has nothing to show. */
  empty: string;
  /** What is counted in a folder's header: "1 Album". */
  unit?: string;
}

const SOURCE_LIST: readonly PhotosSource[] = [
  { id: "photos", name: "Photos", icon: "photos", kind: "collection", empty: "No Photos" },
  { id: "memories", name: "Memories", icon: "memories", kind: "memories", empty: "No Memories" },
  { id: "people", name: "People", icon: "people", kind: "empty", empty: "No People" },
  { id: "places", name: "Places", icon: "places", kind: "empty", empty: "No Places" },
  { id: "recents", name: "Recents", icon: "recents", kind: "collection", empty: "No Photos" },
  { id: "imports", name: "Imports", icon: "imports", kind: "collection", empty: "No Imports" },
  { id: "activity", name: "Activity", icon: "activity", kind: "empty", empty: "No Activity" },
  {
    id: "my-albums",
    name: "My Albums",
    icon: "stack",
    kind: "folder",
    empty: "No Albums",
    unit: "Album",
  },
  {
    id: "wallpapers",
    name: "Wallpapers",
    icon: "thumbnail",
    kind: "collection",
    parent: "my-albums",
    album: true,
    empty: "No Photos",
  },
  {
    id: "my-projects",
    name: "My Projects",
    icon: "stack",
    kind: "folder",
    empty: "No Projects",
    unit: "Project",
  },
  {
    id: "wallpaper-book",
    name: "Wallpaper Book",
    icon: "thumbnail",
    kind: "collection",
    parent: "my-projects",
    empty: "No Photos",
  },
];

/** Every source by its id. */
export const SOURCES = Object.fromEntries(
  SOURCE_LIST.map((source) => [source.id, source]),
) as Record<PhotosSourceId, PhotosSource>;

/** The sidebar: its sections in order, each with its top-level rows. */
export const SECTIONS: readonly { title: string; sources: readonly PhotosSourceId[] }[] = [
  { title: "Library", sources: ["photos", "memories", "people", "places", "recents", "imports"] },
  { title: "Shared", sources: ["activity"] },
  { title: "Albums", sources: ["my-albums"] },
  { title: "Projects", sources: ["my-projects"] },
];

/** The sources inside a folder, in the sidebar's order. */
export const childrenOf = (folder: PhotosSourceId): readonly PhotosSource[] =>
  SOURCE_LIST.filter((source) => source.parent === folder);

const SHAPES: readonly PhotoShape[] = ["disc", "bands", "triangle", "ring", "diagonal", "squares"];
const SHAPE_TITLES: Record<PhotoShape, string> = {
  disc: "Disc",
  bands: "Bands",
  triangle: "Triangle",
  ring: "Ring",
  diagonal: "Diagonal",
  squares: "Squares",
};

/*
 * The shapes of the 17 thumbnails of the captured album, in its order, measured on
 * 10-15-Catalina-Light-Photos.png: one 4:3 picture (128 x 96 pt), then 16:10 (128 x 80),
 * 16:9 (128 x 72) and two squares. The dates run from May 2013 to September 2019, the range
 * the album's header names. The pixel sizes are plausible ones of each shape, not Apple's.
 */
const ALBUM: readonly [date: string, width: number, height: number][] = [
  ["2013-05-20", 4032, 3024],
  ["2013-10-22", 2880, 1800],
  ["2014-02-11", 2880, 1800],
  ["2014-06-02", 2880, 1800],
  ["2014-10-16", 2880, 1800],
  ["2015-03-09", 2880, 1800],
  ["2015-06-08", 2880, 1800],
  ["2015-09-30", 3840, 2160],
  ["2016-03-21", 3840, 2160],
  ["2016-06-13", 3840, 2160],
  ["2016-09-20", 2880, 1800],
  ["2017-06-05", 3840, 2160],
  ["2017-09-25", 3840, 2160],
  ["2018-06-04", 3840, 2160],
  ["2018-09-24", 3840, 2160],
  ["2019-06-03", 3024, 3024],
  ["2019-09-10", 3024, 3024],
];

/* Seven more items that are in the library only: the latest import, one of them a video. */
const IMPORT: readonly [date: string, width: number, height: number, kind: PhotoKind][] = [
  ["2019-10-07", 3024, 4032, "photo"],
  ["2019-10-07", 4032, 3024, "photo"],
  ["2019-10-19", 1920, 1080, "video"],
  ["2019-11-02", 3024, 3024, "photo"],
  ["2019-11-02", 4032, 3024, "photo"],
  ["2019-11-23", 3000, 2000, "photo"],
  ["2019-12-01", 4032, 3024, "photo"],
];

/* The first five pictures of the album are also the pages of the one project. */
const BOOK_PAGES = 5;

const item = (
  index: number,
  date: string,
  width: number,
  height: number,
  kind: PhotoKind,
  albums: readonly string[],
  imported: boolean,
): Photo => {
  const shape = SHAPES[index % SHAPES.length] as PhotoShape;
  return {
    id: `p${String(index + 1).padStart(2, "0")}`,
    title: `${SHAPE_TITLES[shape]} ${index + 1}`,
    date,
    width,
    height,
    kind,
    shape,
    keywords: [shape, kind === "video" ? "video" : "placeholder"],
    albums,
    imported: imported || undefined,
    duration: kind === "video" ? "0:12" : undefined,
  };
};

/** The library the window opens with: the 17 pictures of the album, then the import. */
export const defaultPhotos: readonly Photo[] = [
  ...ALBUM.map(([date, width, height], index) =>
    item(
      index,
      date,
      width,
      height,
      "photo",
      index < BOOK_PAGES ? ["wallpapers", "wallpaper-book"] : ["wallpapers"],
      false,
    ),
  ),
  ...IMPORT.map(([date, width, height, kind], index) =>
    item(ALBUM.length + index, date, width, height, kind, [], true),
  ),
];

/* Recents lists the items added last, newest first. */
const RECENT = 12;

/**
 * The pictures a source holds, before the search and the "Showing" menu narrow them; `null`
 * for a source that is not a collection of pictures. `memory` is the album that was last
 * shown as a memory, which is what Memories lists.
 */
export function photosOf(
  source: PhotosSourceId,
  photos: readonly Photo[],
  memory: PhotosSourceId | null,
): readonly Photo[] | null {
  const { kind } = SOURCES[source];
  if (kind === "memories") return memory ? photosOf(memory, photos, null) : null;
  if (kind !== "collection") return null;
  if (source === "photos") return photos;
  if (source === "recents") return photos.slice(-RECENT).reverse();
  if (source === "imports") return photos.filter((photo) => photo.imported);
  return photos.filter((photo) => photo.albums.includes(source));
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

/** "May 2013" for a date. The months are written out here: no locale decides the text. */
const monthOf = (date: string) => `${MONTHS[Number(date.slice(5, 7)) - 1]} ${date.slice(0, 4)}`;

/** "May 20, 2013" for a date. */
export const dayOf = (date: string) =>
  `${MONTHS[Number(date.slice(5, 7)) - 1]} ${Number(date.slice(8, 10))}, ${date.slice(0, 4)}`;

/** The months the pictures span, as the header writes them: "May 2013 – September 2019". */
export function dateRange(photos: readonly Photo[]): string {
  if (photos.length === 0) return "";
  const dates = photos.map((photo) => photo.date).sort();
  const first = monthOf(dates[0] as string);
  const last = monthOf(dates.at(-1) as string);
  return first === last ? first : `${first} – ${last}`;
}

const counted = (count: number, one: string) => `${count} ${one}${count === 1 ? "" : "s"}`;

/** What the header counts: "17 Photos", "23 Photos, 1 Video", "1 Album". */
export function countText(photos: readonly Photo[]): string {
  const videos = photos.filter((photo) => photo.kind === "video").length;
  const stills = photos.length - videos;
  if (videos === 0) return counted(stills, "Photo");
  if (stills === 0) return counted(videos, "Video");
  return `${counted(stills, "Photo")}, ${counted(videos, "Video")}`;
}

/** "1 Album", "2 Projects". */
export const unitText = counted;

/**
 * Whether a search finds the picture: every word of the query starts a word of its title,
 * its keywords or the month and year it was taken. Case and surrounding space are ignored,
 * and an empty query finds everything.
 */
export function matches(photo: Photo, query: string): boolean {
  const words = `${photo.title} ${photo.keywords.join(" ")} ${monthOf(photo.date)}`
    .toLowerCase()
    .split(/\s+/);
  return query
    .toLowerCase()
    .split(/\s+/)
    .filter(Boolean)
    .every((typed) => words.some((word) => word.startsWith(typed)));
}

/** Whether the "Showing" menu lets the picture through. */
export function passes(
  photo: Photo,
  filter: PhotosFilter,
  state: { favorite: boolean; edited: boolean },
): boolean {
  if (filter === "favorites") return state.favorite;
  if (filter === "edited") return state.edited;
  if (filter === "photos") return photo.kind === "photo";
  if (filter === "videos") return photo.kind === "video";
  return true;
}

/** The least, the default and the greatest value of the zoom slider. */
export const ZOOM = { min: 0, max: 100, step: 5, default: 50 } as const;

/**
 * The side of a thumbnail's cell in points for a value of the zoom slider: 64 pt at its
 * least, 256 pt at its greatest and 128 pt, the captured size, in the middle.
 */
export const cellSize = (zoom: number) =>
  Math.round(64 * 4 ** ((Math.min(ZOOM.max, Math.max(ZOOM.min, zoom)) - ZOOM.min) / ZOOM.max));

/**
 * A picture fitted into a square cell of `size` points: its longer side is the cell's.
 * `turns` quarter turns swap its sides.
 */
export function fitted(photo: Photo, size: number, turns = 0): { width: number; height: number } {
  const [width, height] = turns % 2 ? [photo.height, photo.width] : [photo.width, photo.height];
  const scale = size / Math.max(width, height);
  return { width: Math.round(width * scale), height: Math.round(height * scale) };
}
