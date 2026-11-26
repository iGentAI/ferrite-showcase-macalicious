/*
 * What the served Photos window lists and how: its sources, the groups of the Days, Months and
 * Years views, searching, and the words it shows. Pure functions over the library, so the
 * window and its tests share them.
 */

import { editedSize, NO_EDIT } from "./photos-edit";
import type {
  AlbumSort,
  LibraryAlbum,
  LibraryPhoto,
  SmartAlbum,
  SmartRule,
} from "./photos-library";
import { withoutNearDuplicates } from "./photos-near-duplicates";
import { sceneMemoryTitle, sceneWords } from "./photos-scenes";

/** A row of the sidebar: a library view, a media type, an album, a smart album or a slideshow. */
export type ServedSource =
  | "library"
  | "my-albums"
  | "memories"
  | `memory:${string}`
  | "people"
  | `person:${string}`
  | "favorites"
  | "recents"
  | "imports"
  | "photo-booth"
  | "hidden"
  | "deleted"
  | MediaType
  | "places"
  | `album:${string}`
  | `smart:${string}`
  | `project:${string}`
  | `keyword:${string}`;

/** The rows of Media Types, which the sidebar shows only when they hold something. */
export type MediaType = "videos" | "selfies" | "panoramas" | "screenshots" | "animated";

export const MEDIA_SOURCES: readonly { id: MediaType; name: string }[] = [
  { id: "videos", name: "Videos" },
  { id: "selfies", name: "Selfies" },
  { id: "panoramas", name: "Panoramas" },
  { id: "screenshots", name: "Screenshots" },
  { id: "animated", name: "Animated" },
];

/** The Shared rows of a Mac's sidebar: iCloud's, and always dimmed here, with why. */
export const SHARED_ROWS: readonly { name: string; reason: string }[] = [
  {
    name: "Activity",
    reason: "Shared activity comes from iCloud, which this desktop can't reach.",
  },
  {
    name: "Shared Albums",
    reason: "Shared albums live in iCloud, which this desktop can't reach.",
  },
];

/** Whether a photo is a movie. */
export const isVideo = (photo: Pick<LibraryPhoto, "mime">) => photo.mime.startsWith("video/");

/** Whether a photo is of the media type, from what its file says: no picture is analysed. */
export function isMediaType(photo: LibraryPhoto, type: MediaType): boolean {
  switch (type) {
    case "videos":
      return isVideo(photo);
    case "selfies":
      return /front/i.test(photo.exif?.lens ?? "");
    case "panoramas": {
      const long = Math.max(photo.width, photo.height);
      return long >= 2.5 * Math.min(photo.width, photo.height);
    }
    case "screenshots":
      return /^screen ?shot/i.test(photo.name);
    case "animated":
      return photo.mime === "image/gif";
  }
}

/** The name a photo shows: its title, else its file's name. */
export const titleOf = (photo: Pick<LibraryPhoto, "name" | "title">) => photo.title ?? photo.name;

/** The library's rows of the sidebar, in order. */
export const LIBRARY_SOURCES: readonly { id: ServedSource; name: string; empty: string }[] = [
  { id: "library", name: "Photos", empty: "No Photos" },
  { id: "memories", name: "Memories", empty: "No Memories Yet" },
  { id: "favorites", name: "Favorites", empty: "No Favorites" },
  {
    id: "people",
    name: "People",
    empty: "No People Yet. Name someone in a photo’s Info; this desktop detects no faces.",
  },
  { id: "recents", name: "Recents", empty: "No Recent Photos" },
  { id: "imports", name: "Imports", empty: "No Imports" },
  { id: "photo-booth", name: "Photo Booth", empty: "No Photo Booth Pictures" },
  { id: "hidden", name: "Hidden", empty: "No Hidden Photos" },
  { id: "deleted", name: "Recently Deleted", empty: "No Recently Deleted Items" },
];

/** How the Photos row shows the library. */
export type LibraryView = "years" | "months" | "days" | "all";

export const LIBRARY_VIEWS: readonly { id: LibraryView; name: string }[] = [
  { id: "years", name: "Years" },
  { id: "months", name: "Months" },
  { id: "days", name: "Days" },
  { id: "all", name: "All Photos" },
];

/** A choice of the "Showing" menu: a fixed one, or one keyword. */
export type ServedFilter =
  | "all"
  | "favorites"
  | "edited"
  | "photos"
  | "videos"
  | `keyword:${string}`;

export const SERVED_FILTERS: readonly { id: ServedFilter; title: string; empty: string }[] = [
  { id: "all", title: "All Items", empty: "No Photos" },
  { id: "favorites", title: "Favorites", empty: "No Favorites" },
  { id: "edited", title: "Edited", empty: "No Edited Photos" },
  { id: "photos", title: "Photos", empty: "No Photos" },
  { id: "videos", title: "Videos", empty: "No Videos" },
];

/** What a rule of a smart album can ask, as its sheet offers it (the module's `RULE_FIELDS`). */
export const RULE_FIELDS: readonly {
  id: string;
  name: string;
  ops: readonly { id: string; name: string }[];
  /** The fixed values of a field that has them. */
  values?: readonly { id: string; name: string }[];
}[] = [
  {
    id: "album",
    name: "Album",
    ops: [
      { id: "is", name: "is" },
      { id: "is-not", name: "is not" },
    ],
  },
  {
    id: "camera",
    name: "Camera Model",
    ops: [
      { id: "includes", name: "includes" },
      { id: "excludes", name: "does not include" },
    ],
  },
  {
    id: "caption",
    name: "Caption",
    ops: [
      { id: "includes", name: "includes" },
      { id: "excludes", name: "does not include" },
    ],
  },
  {
    id: "date",
    name: "Date",
    ops: [
      { id: "before", name: "is before" },
      { id: "after", name: "is after" },
      { id: "in-last", name: "is in the last (days)" },
    ],
  },
  {
    id: "favorite",
    name: "Photo",
    ops: [
      { id: "is", name: "is" },
      { id: "is-not", name: "is not" },
    ],
    values: [
      { id: "favorite", name: "favorite" },
      { id: "edited", name: "edited" },
      { id: "video", name: "a video" },
    ],
  },
  {
    id: "filename",
    name: "Filename",
    ops: [
      { id: "includes", name: "includes" },
      { id: "excludes", name: "does not include" },
    ],
  },
  {
    id: "keyword",
    name: "Keyword",
    ops: [
      { id: "is", name: "is" },
      { id: "is-not", name: "is not" },
    ],
  },
  {
    id: "location",
    name: "Location",
    ops: [
      { id: "includes", name: "includes" },
      { id: "excludes", name: "does not include" },
    ],
  },
  {
    id: "title",
    name: "Title",
    ops: [
      { id: "includes", name: "includes" },
      { id: "excludes", name: "does not include" },
    ],
  },
  {
    id: "text",
    name: "Text",
    ops: [
      { id: "includes", name: "includes" },
      { id: "excludes", name: "does not include" },
    ],
  },
];

const has = (haystack: string | null | undefined, needle: string) =>
  (haystack ?? "").toLowerCase().includes(needle.trim().toLowerCase());

/** Whether a photo meets one rule of a smart album. */
export function ruleMatches(
  photo: LibraryPhoto,
  rule: SmartRule,
  albums: readonly LibraryAlbum[],
  now: number,
): boolean {
  const negate = rule.op === "is-not" || rule.op === "excludes";
  const answer = (met: boolean) => (negate ? !met : met);
  switch (rule.field) {
    case "album":
      return answer(
        albums.some((album) => album.name === rule.value && album.photos.includes(photo.id)),
      );
    case "camera":
      return answer(has(photo.camera, rule.value));
    case "caption":
      return answer(has(photo.caption, rule.value));
    case "filename":
      return answer(has(photo.name, rule.value));
    case "title":
      return answer(has(photo.title, rule.value));
    case "location":
      return answer(has(photo.location?.name, rule.value));
    case "keyword":
      return answer(
        photo.keywords.some((word) => word.toLowerCase() === rule.value.trim().toLowerCase()),
      );
    case "favorite":
      if (rule.value === "edited") return answer(photo.edit !== null);
      if (rule.value === "video") return answer(isVideo(photo));
      return answer(photo.favorite);
    case "text":
      return answer(
        [titleOf(photo), photo.caption, photo.location?.name, photo.camera, ...photo.keywords].some(
          (each) => has(each, rule.value),
        ),
      );
    case "date": {
      if (rule.op === "in-last") {
        const days = Number(rule.value);
        return Number.isFinite(days) && photo.taken_ms >= now - days * DAY_MS;
      }
      const day = /^(\d{4})-(\d{2})-(\d{2})$/.exec(rule.value);
      if (!day) return false;
      // The start of that day where the person is, as the dates they see and edit are.
      const [year, month, date] = [Number(day[1]), Number(day[2]), Number(day[3])];
      const start = new Date(year, month - 1, date);
      if (start.getMonth() !== month - 1 || start.getDate() !== date) return false;
      const when = start.getTime();
      return rule.op === "before" ? photo.taken_ms < when : photo.taken_ms >= when;
    }
    default:
      return false;
  }
}

/** Whether a photo belongs in a smart album. */
export function smartMatches(
  photo: LibraryPhoto,
  album: Pick<SmartAlbum, "any" | "rules">,
  albums: readonly LibraryAlbum[],
  now: number,
): boolean {
  if (album.rules.length === 0) return false;
  const met = (rule: SmartRule) => ruleMatches(photo, rule, albums, now);
  return album.any ? album.rules.some(met) : album.rules.every(met);
}

/** Every keyword the library's photos and the manager's list hold, sorted. */
export function allKeywords(
  photos: readonly LibraryPhoto[],
  managed: readonly { name: string }[],
): string[] {
  const seen = new Map<string, string>();
  for (const each of managed) seen.set(each.name.toLowerCase(), each.name);
  for (const photo of photos) {
    for (const word of photo.keywords) {
      if (!seen.has(word.toLowerCase())) seen.set(word.toLowerCase(), word);
    }
  }
  return [...seen.values()].sort((a, b) => a.localeCompare(b));
}

/** A shutter speed as a camera shows it: "1/250 s" or "2 s". */
export function shutterText(seconds: number): string {
  if (seconds >= 1) return `${Math.round(seconds * 10) / 10} s`;
  return `1/${Math.round(1 / seconds)} s`;
}

/** The camera's settings as Info lists them: lens; ISO, focal length, bias, aperture, shutter. */
export function exifLines(photo: Pick<LibraryPhoto, "exif">): string[] {
  const exif = photo.exif;
  if (!exif) return [];
  const settings = [
    exif.iso !== undefined ? `ISO ${exif.iso}` : "",
    exif.focal !== undefined ? `${Math.round(exif.focal)} mm` : "",
    exif.bias !== undefined
      ? `${exif.bias > 0 ? "+" : ""}${Math.round(exif.bias * 10) / 10} ev`
      : "",
    exif.aperture !== undefined ? `ƒ/${Math.round(exif.aperture * 10) / 10}` : "",
    exif.exposure !== undefined ? shutterText(exif.exposure) : "",
  ].filter(Boolean);
  return [exif.lens ?? "", settings.join("  ")].filter(Boolean);
}

/** The orders an album can list its photos in, as the View menu and the album's header name them. */
export const ALBUM_SORTS: readonly { id: AlbumSort; title: string }[] = [
  { id: "custom", title: "Order Added" },
  { id: "oldest", title: "Oldest First" },
  { id: "newest", title: "Newest First" },
  { id: "title", title: "Title" },
];

/** How long Recents looks back: 30 days. */
export const RECENT_MS = 30 * 24 * 60 * 60 * 1000;

const DAY_MS = 24 * 60 * 60 * 1000;

export const MONTHS = [
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

const WEEKDAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

/** "October 2019", in the browser's time zone. */
export const monthText = (ms: number) => {
  const date = new Date(ms);
  return `${MONTHS[date.getMonth()]} ${date.getFullYear()}`;
};

/** "October 7, 2019". */
export const dayText = (ms: number) => {
  const date = new Date(ms);
  return `${MONTHS[date.getMonth()]} ${date.getDate()}, ${date.getFullYear()}`;
};

/** "Monday, October 7, 2019". */
export const weekdayText = (ms: number) => `${WEEKDAYS[new Date(ms).getDay()]}, ${dayText(ms)}`;

/** "2:03 PM". */
export const timeText = (ms: number) => {
  const date = new Date(ms);
  const hours = date.getHours();
  const minutes = String(date.getMinutes()).padStart(2, "0");
  return `${hours % 12 || 12}:${minutes} ${hours < 12 ? "AM" : "PM"}`;
};

/** "2.4 MB", in decimal units as the Finder counts. */
export function sizeText(bytes: number): string {
  if (bytes < 1000) return `${bytes} bytes`;
  if (bytes < 1_000_000) return `${Math.round(bytes / 1000)} KB`;
  return `${(bytes / 1_000_000).toFixed(1)} MB`;
}

const counted = (count: number, one: string) => `${count} ${one}${count === 1 ? "" : "s"}`;

/** "17 Photos". */
export const photoCount = (count: number) => counted(count, "Photo");

/**
 * What an import says when files were not imported: how many of how many, and each one's reason
 * (the first four, then how many more). Nothing when every file was imported.
 */
export function importNotice(total: number, reasons: readonly string[]): string | null {
  if (reasons.length === 0) return null;
  const shown = reasons.slice(0, 4).join("; ");
  const more = reasons.length > 4 ? `; and ${reasons.length - 4} more` : "";
  const files = total === 1 ? "file was" : "files were";
  return `${reasons.length} of ${total} ${files} not imported: ${shown}${more}.`;
}

/** The months the photos span: "May 2013 – September 2019". */
export function spanText(photos: readonly LibraryPhoto[]): string {
  if (photos.length === 0) return "";
  let first = Number.POSITIVE_INFINITY;
  let last = Number.NEGATIVE_INFINITY;
  for (const photo of photos) {
    first = Math.min(first, photo.taken_ms);
    last = Math.max(last, photo.taken_ms);
  }
  const from = monthText(first);
  const to = monthText(last);
  return from === to ? from : `${from} – ${to}`;
}

/** Days left before a photo in Recently Deleted is deleted for good. */
export function daysLeft(photo: LibraryPhoto, now: number, keepDays = 30): number {
  if (photo.deleted_ms === null) return keepDays;
  return Math.min(
    keepDays,
    Math.max(0, Math.ceil((photo.deleted_ms + keepDays * DAY_MS - now) / DAY_MS)),
  );
}

/** The album a source names, if it names one. */
export const albumOf = (source: ServedSource, albums: readonly LibraryAlbum[]) =>
  source.startsWith("album:") ? albums.find((album) => `album:${album.id}` === source) : undefined;

const byTaken = (a: LibraryPhoto, b: LibraryPhoto) =>
  a.taken_ms - b.taken_ms || a.id.localeCompare(b.id);

/** An album's photos (in the order they were added) in the order the album lists them. */
export function sortAlbumPhotos(photos: readonly LibraryPhoto[], sort: AlbumSort): LibraryPhoto[] {
  switch (sort) {
    case "oldest":
      return [...photos].sort(byTaken);
    case "newest":
      return [...photos].sort((a, b) => b.taken_ms - a.taken_ms || a.id.localeCompare(b.id));
    case "title":
      return [...photos].sort(
        (a, b) =>
          a.name.localeCompare(b.name, undefined, { numeric: true, sensitivity: "base" }) ||
          a.id.localeCompare(b.id),
      );
    default:
      return [...photos];
  }
}

/**
 * The photos a Shift-click selects: every one from the anchor (the last photo clicked without
 * Shift) to the one clicked, in the order they are shown. Without an anchor in the list, only the
 * one clicked.
 */
export function rangeIds(
  order: readonly string[],
  anchor: string | null,
  target: string,
): string[] {
  const to = order.indexOf(target);
  if (to < 0) return [];
  const from = anchor === null ? -1 : order.indexOf(anchor);
  if (from < 0) return [target];
  return order.slice(Math.min(from, to), Math.max(from, to) + 1);
}

/** A person of the People row: the name given in Info and the photos that carry it. */
export interface Person {
  name: string;
  photos: LibraryPhoto[];
}

/** The People row, by most photos, then by name. Names differing only in case are one person. */
export function peopleOf(photos: readonly LibraryPhoto[]): Person[] {
  const people = new Map<string, Person>();
  for (const photo of photos) {
    if (photo.deleted_ms !== null || photo.hidden) continue;
    for (const name of photo.people) {
      const key = name.toLowerCase();
      const person = people.get(key);
      if (person) person.photos.push(photo);
      else people.set(key, { name, photos: [photo] });
    }
  }
  return [...people.values()].sort(
    (a, b) => b.photos.length - a.photos.length || a.name.localeCompare(b.name),
  );
}

/** The fewest photos of one run of days that make a memory, and of one year. */
const MEMORY_PHOTOS = 3;
const YEAR_MEMORY_PHOTOS = 6;
/** The photos a scene needs for a memory of its own. */
const SCENE_MEMORY_PHOTOS = 6;
/** The longest gap inside one run of days. */
const MEMORY_GAP_MS = 2 * DAY_MS;

/** A collection made from the library's dates and places, near-duplicates left out. */
export interface Memory {
  id: string;
  title: string;
  detail: string;
  photos: LibraryPhoto[];
}

function commonPlace(photos: readonly LibraryPhoto[]): string | undefined {
  const counts = new Map<string, number>();
  for (const photo of photos) {
    const name = photo.location?.name;
    if (name) counts.set(name, (counts.get(name) ?? 0) + 1);
  }
  let best: string | undefined;
  for (const [name, count] of counts) {
    if (best === undefined || count > (counts.get(best) ?? 0)) best = name;
  }
  return best;
}

/**
 * The Memories row, newest first: each run of photos taken at most two days apart, named for its
 * commonest place or else its first day, a "Best of" per year, favourites first, and one for each
 * scene that six photos of more than one day show. A run's id
 * is its first photo's, so it keeps its address as later photos join it.
 */
export function memoriesOf(photos: readonly LibraryPhoto[]): Memory[] {
  const kept = photos.filter((photo) => photo.deleted_ms === null && !photo.hidden).sort(byTaken);
  const runs: LibraryPhoto[][] = [];
  for (const photo of kept) {
    const run = runs[runs.length - 1];
    const last = run?.[run.length - 1];
    if (run && last && photo.taken_ms - last.taken_ms <= MEMORY_GAP_MS) run.push(photo);
    else runs.push([photo]);
  }
  const memories: { at: number; memory: Memory }[] = [];
  for (const run of runs) {
    const first = run[0];
    const held = withoutNearDuplicates(run);
    if (!first || held.length < MEMORY_PHOTOS) continue;
    memories.push({
      at: first.taken_ms,
      memory: {
        id: `run-${first.id}`,
        title: commonPlace(run) ?? dayText(first.taken_ms),
        detail: `${spanText(held)}, ${photoCount(held.length)}`,
        photos: held,
      },
    });
  }
  const years = new Map<number, LibraryPhoto[]>();
  for (const photo of kept) {
    const year = new Date(photo.taken_ms).getFullYear();
    years.set(year, [...(years.get(year) ?? []), photo]);
  }
  for (const [year, all] of years) {
    const list = withoutNearDuplicates(all);
    if (list.length < YEAR_MEMORY_PHOTOS) continue;
    memories.push({
      at: new Date(year, 11, 31).getTime(),
      memory: {
        id: `year-${year}`,
        title: `Best of ${year}`,
        detail: photoCount(list.length),
        photos: [
          ...list.filter((photo) => photo.favorite),
          ...list.filter((photo) => !photo.favorite),
        ],
      },
    });
  }
  const scenes = new Map<string, LibraryPhoto[]>();
  for (const photo of kept) {
    for (const scene of photo.scenes ?? [])
      scenes.set(scene, [...(scenes.get(scene) ?? []), photo]);
  }
  for (const [scene, all] of scenes) {
    const list = withoutNearDuplicates(all);
    const days = new Set(list.map((photo) => new Date(photo.taken_ms).toDateString()));
    const latest = list[list.length - 1];
    if (!latest || list.length < SCENE_MEMORY_PHOTOS || days.size < 2) continue;
    memories.push({
      at: latest.taken_ms,
      memory: {
        id: `scene-${scene}`,
        title: sceneMemoryTitle(scene),
        detail: `${spanText(list)}, ${photoCount(list.length)}`,
        photos: list,
      },
    });
  }
  return memories.sort((a, b) => b.at - a.at).map((each) => each.memory);
}

/** The photos a source holds, in its order, before searching and the "Showing" menu. */
export function photosOfSource(
  source: ServedSource,
  photos: readonly LibraryPhoto[],
  albums: readonly LibraryAlbum[],
  now: number,
  smartAlbums: readonly SmartAlbum[] = [],
  projects: readonly { id: string; photos: readonly string[] }[] = [],
): LibraryPhoto[] {
  const shown = photos.filter((photo) => photo.deleted_ms === null);
  const kept = shown.filter((photo) => !photo.hidden);
  switch (source) {
    case "library":
      return [...kept].sort(byTaken);
    case "memories":
      return [...new Set(memoriesOf(photos).flatMap((memory) => memory.photos))];
    case "people":
      return [
        ...new Set([
          ...peopleOf(photos).flatMap((person) => person.photos),
          ...photos.filter(
            (photo) =>
              photo.deleted_ms === null &&
              !photo.hidden &&
              photo.faces?.some((face) => !face.name && !face.not_a_face),
          ),
        ]),
      ];
    case "favorites":
      return kept.filter((photo) => photo.favorite).sort(byTaken);
    case "recents":
      return kept
        .filter((photo) => now - photo.added_ms <= RECENT_MS)
        .sort((a, b) => b.added_ms - a.added_ms || a.id.localeCompare(b.id));
    case "imports":
      return kept
        .filter((photo) => photo.source === "import")
        .sort((a, b) => b.added_ms - a.added_ms || a.id.localeCompare(b.id));
    case "photo-booth":
      return kept.filter((photo) => photo.source === "photo-booth").sort(byTaken);
    case "hidden":
      return shown.filter((photo) => photo.hidden).sort(byTaken);
    case "places":
      return kept.filter((photo) => photo.location !== null).sort(byTaken);
    case "videos":
    case "selfies":
    case "panoramas":
    case "screenshots":
    case "animated":
      return kept.filter((photo) => isMediaType(photo, source)).sort(byTaken);
    case "deleted":
      return photos
        .filter((photo) => photo.deleted_ms !== null)
        .sort((a, b) => (b.deleted_ms ?? 0) - (a.deleted_ms ?? 0) || a.id.localeCompare(b.id));
    default: {
      if (source.startsWith("person:")) {
        const name = source.slice("person:".length).toLowerCase();
        return (
          peopleOf(photos)
            .find((person) => person.name.toLowerCase() === name)
            ?.photos.sort(byTaken) ?? []
        );
      }
      if (source.startsWith("memory:")) {
        const id = source.slice("memory:".length);
        return memoriesOf(photos).find((memory) => memory.id === id)?.photos ?? [];
      }
      if (source.startsWith("keyword:")) {
        const word = source.slice("keyword:".length).toLowerCase();
        return kept
          .filter((photo) => photo.keywords.some((each) => each.toLowerCase() === word))
          .sort(byTaken);
      }
      if (source.startsWith("smart:")) {
        const smart = smartAlbums.find((each) => `smart:${each.id}` === source);
        if (!smart) return [];
        return kept.filter((photo) => smartMatches(photo, smart, albums, now)).sort(byTaken);
      }
      const byId = new Map(kept.map((photo) => [photo.id, photo]));
      if (source.startsWith("project:")) {
        const project = projects.find((each) => `project:${each.id}` === source);
        return (project?.photos ?? []).flatMap((id) => byId.get(id) ?? []);
      }
      const album = albumOf(source, albums);
      if (!album) return [];
      return sortAlbumPhotos(
        album.photos.flatMap((id) => byId.get(id) ?? []),
        album.sort,
      );
    }
  }
}

/**
 * Whether a search finds the photo: every word typed starts a word of its title, name, caption,
 * keywords, place, camera, lens, month and year, the albums it is in, or "favorite" and "edited"
 * for what it is.
 */
export function searchMatches(
  photo: LibraryPhoto,
  query: string,
  albums: readonly LibraryAlbum[],
): boolean {
  return wordsMatch(searchWords(query), photoWords(photo, albums));
}

const searchWords = (text: string) =>
  text
    .toLowerCase()
    .split(/[\s_.,-]+/)
    .filter(Boolean);

const wordsMatch = (typed: readonly string[], words: readonly string[]) =>
  typed.every((word) => words.some((each) => each.startsWith(word)));

function photoWords(photo: LibraryPhoto, albums: readonly LibraryAlbum[]) {
  return searchWords(
    [
      photo.name,
      photo.title ?? "",
      photo.caption ?? "",
      ...photo.keywords,
      ...(photo.scenes ?? []).map(sceneWords),
      ...photo.people,
      photo.location?.name ?? "",
      photo.camera ?? "",
      photo.exif?.lens ?? "",
      monthText(photo.taken_ms),
      String(new Date(photo.taken_ms).getDate()),
      ...albums.filter((album) => album.photos.includes(photo.id)).map((album) => album.name),
      photo.favorite ? "favorite favourite" : "",
      photo.edit ? "edited" : "",
      photo.source === "photo-booth" ? "photo booth" : "",
      isVideo(photo) ? "video" : "",
    ].join(" "),
  );
}

/** A row of the search field's list: what the library holds, and how many photos searching for it finds. */
export interface SearchSuggestion {
  kind: string;
  text: string;
  count: number;
}

const SUGGESTION_KINDS: readonly {
  kind: string;
  of: (photo: LibraryPhoto) => readonly (string | null | undefined)[];
}[] = [
  { kind: "People", of: (photo) => photo.people },
  { kind: "Places", of: (photo) => [photo.location?.name] },
  { kind: "Keywords", of: (photo) => photo.keywords },
  { kind: "Dates", of: (photo) => [monthText(photo.taken_ms)] },
  { kind: "Cameras", of: (photo) => [photo.camera] },
  { kind: "Photos", of: (photo) => [photo.title || photo.name] },
  { kind: "Scenes", of: (photo) => photo.scenes ?? [] },
];

/**
 * What the search field lists under what is typed, kind by kind: the people, places, keywords,
 * months, albums, cameras and photos whose words begin with it, at most `perKind` of each. A row's
 * count is what a search for its text finds, so it never promises more than the results show.
 */
export function searchSuggestions(
  photos: readonly LibraryPhoto[],
  query: string,
  albums: readonly LibraryAlbum[],
  perKind = 3,
): SearchSuggestion[] {
  const typed = searchWords(query);
  if (typed.length === 0) return [];
  const indexed = photos.map((photo) => photoWords(photo, albums));
  const rows = (kind: string, texts: Iterable<string | null | undefined>) => {
    const seen = new Set<string>();
    const found: SearchSuggestion[] = [];
    for (const text of texts) {
      if (found.length >= perKind) break;
      if (!text || seen.has(text.toLowerCase())) continue;
      seen.add(text.toLowerCase());
      const own = searchWords(text);
      if (!wordsMatch(typed, own)) continue;
      const count = indexed.filter((words) => wordsMatch(own, words)).length;
      if (count > 0) found.push({ kind, text, count });
    }
    return found;
  };
  return [
    ...SUGGESTION_KINDS.slice(0, 4).flatMap(({ kind, of }) => rows(kind, photos.flatMap(of))),
    ...rows(
      "Albums",
      albums.map((album) => album.name),
    ),
    ...SUGGESTION_KINDS.slice(4).flatMap(({ kind, of }) => rows(kind, photos.flatMap(of))),
  ];
}

/** Whether the "Showing" menu lets the photo through. */
export function filterPasses(photo: LibraryPhoto, filter: ServedFilter): boolean {
  if (filter.startsWith("keyword:")) {
    const word = filter.slice("keyword:".length).toLowerCase();
    return photo.keywords.some((each) => each.toLowerCase() === word);
  }
  switch (filter) {
    case "favorites":
      return photo.favorite;
    case "edited":
      return photo.edit !== null;
    case "photos":
      return !isVideo(photo);
    case "videos":
      return isVideo(photo);
    default:
      return true;
  }
}

/** A group of the Days, Months or Years view: its key, heading and photos. */
export interface PhotoGroup {
  key: string;
  title: string;
  /** A second line: the places its photos name, if any, and how many photos it holds. */
  detail: string;
  photos: LibraryPhoto[];
  /** In Days: how many near-duplicates of this day are not in `photos`, or would not be. */
  leftOut?: number;
}

/** A day as the Days view shows it: near-duplicates left out, unless `all` of it is asked for. */
export function curatedDay(group: PhotoGroup, all: boolean): PhotoGroup {
  const held = withoutNearDuplicates(group.photos);
  const leftOut = group.photos.length - held.length;
  return { ...group, photos: all ? group.photos : held, leftOut };
}

const keyOf = (ms: number, unit: "day" | "month" | "year") => {
  const date = new Date(ms);
  const year = String(date.getFullYear());
  if (unit === "year") return year;
  const month = `${year}-${String(date.getMonth() + 1).padStart(2, "0")}`;
  return unit === "month" ? month : `${month}-${String(date.getDate()).padStart(2, "0")}`;
};

/** Photos, taken in order, grouped by the day, month or year they were taken. */
export function groupPhotos(
  photos: readonly LibraryPhoto[],
  unit: "day" | "month" | "year",
): PhotoGroup[] {
  const groups: PhotoGroup[] = [];
  for (const photo of [...photos].sort(byTaken)) {
    const key = keyOf(photo.taken_ms, unit);
    let group = groups.at(-1);
    if (!group || group.key !== key) {
      const title =
        unit === "day"
          ? weekdayText(photo.taken_ms)
          : unit === "month"
            ? monthText(photo.taken_ms)
            : String(new Date(photo.taken_ms).getFullYear());
      group = { key, title, detail: "", photos: [] };
      groups.push(group);
    }
    group.photos.push(photo);
  }
  for (const group of groups) {
    const places = placesText(group.photos);
    const count = photoCount(group.photos.length);
    group.detail = places ? `${places}, ${count}` : count;
  }
  return groups;
}

/** "Delft & Leiden", or "Delft, Leiden & 2 more": the named places of some photos, commonest first. */
function placesText(photos: readonly LibraryPhoto[]): string {
  const counts = new Map<string, number>();
  for (const photo of photos) {
    const name = photo.location?.name;
    if (name) counts.set(name, (counts.get(name) ?? 0) + 1);
  }
  const names = [...counts.entries()].sort((a, b) => b[1] - a[1]).map(([name]) => name);
  const [first, second] = names;
  if (names.length > 2) return `${first}, ${second} & ${names.length - 2} more`;
  return names.join(" & ");
}

/** The longest pause inside one import: photos added further apart were separate imports. */
const IMPORT_GAP_MS = 2 * 60_000;

/** The Imports row's batches, newest first: photos added one after another, under when it was. */
export function importBatches(photos: readonly LibraryPhoto[]): PhotoGroup[] {
  const groups: PhotoGroup[] = [];
  let last = 0;
  for (const photo of [...photos].sort(
    (a, b) => b.added_ms - a.added_ms || a.id.localeCompare(b.id),
  )) {
    let group = groups.at(-1);
    if (!group || last - photo.added_ms >= IMPORT_GAP_MS) {
      const time = new Date(photo.added_ms).toLocaleTimeString(undefined, {
        hour: "numeric",
        minute: "2-digit",
      });
      group = {
        key: `import-${photo.added_ms}`,
        title: `${dayText(photo.added_ms)} at ${time}`,
        detail: "",
        photos: [],
      };
      groups.push(group);
    }
    group.photos.push(photo);
    last = photo.added_ms;
  }
  for (const group of groups) group.detail = photoCount(group.photos.length);
  return groups;
}

/** The pixel size a photo shows at, edited. */
export const shownSize = (photo: LibraryPhoto) =>
  editedSize(photo.width, photo.height, photo.edit ?? NO_EDIT);

/** A photo's size fitted into a square of `side` points. */
export function fittedBox(photo: LibraryPhoto, side: number) {
  const { width, height } = shownSize(photo);
  const scale = side / Math.max(width, height);
  return {
    width: Math.max(1, Math.round(width * scale)),
    height: Math.max(1, Math.round(height * scale)),
  };
}

/** The key a thumbnail is read and kept under: it changes with every edit. */
export const thumbKey = (photo: LibraryPhoto) => `${photo.id}:${photo.edited_ms ?? 0}`;
