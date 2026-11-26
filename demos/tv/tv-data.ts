/*
 * The catalogue of the demo and what its windows share. Every title is invented: nothing here
 * names a film, a series or a studio, and nothing is streamed.
 */

/** The sections of the toolbar's segmented control. */
export type TvSection = "watch-now" | "movies" | "tv-shows" | "kids" | "library";

/** The sections in the toolbar's order, with their titles as captured. */
export const SECTIONS: readonly { id: TvSection; name: string }[] = [
  { id: "watch-now", name: "Watch Now" },
  { id: "movies", name: "Movies" },
  { id: "tv-shows", name: "TV Shows" },
  { id: "kids", name: "Kids" },
  { id: "library", name: "Library" },
];

/** A film or a series of the catalogue. */
export interface TvTitle {
  /** Identifies the title. */
  id: string;
  /** Its name. */
  title: string;
  /** A film or a series. */
  kind: "movie" | "show";
  /** Whether the Kids section lists it. */
  kids: boolean;
  /** The year it came out. */
  year: number;
  /** Its genre, one or two words. */
  genre: string;
  /** A sentence about it. */
  description: string;
}

/** The twelve titles of the demo, all invented. */
export const defaultTitles: readonly TvTitle[] = [
  {
    id: "harbour-lights",
    title: "Harbour Lights",
    kind: "show",
    kids: false,
    year: 2019,
    genre: "Drama",
    description: "Three generations of a family keep a ferry line running through a hard winter.",
  },
  {
    id: "paper-rockets",
    title: "Paper Rockets",
    kind: "movie",
    kids: true,
    year: 2019,
    genre: "Animation",
    description: "A boy and his little sister fold a rocket big enough to leave the attic.",
  },
  {
    id: "the-long-table",
    title: "The Long Table",
    kind: "show",
    kids: false,
    year: 2018,
    genre: "Comedy",
    description: "Every Sunday the whole street eats together, and nobody agrees on anything.",
  },
  {
    id: "night-shift-diner",
    title: "Night Shift Diner",
    kind: "show",
    kids: false,
    year: 2017,
    genre: "Comedy",
    description: "The regulars of an all-night diner solve very small mysteries.",
  },
  {
    id: "signal-fires",
    title: "Signal Fires",
    kind: "movie",
    kids: false,
    year: 2018,
    genre: "Adventure",
    description: "A cartographer crosses a mountain range that is missing from every map.",
  },
  {
    id: "little-engines",
    title: "Little Engines",
    kind: "show",
    kids: true,
    year: 2019,
    genre: "Kids & Family",
    description: "Four small trains learn the timetable, one station at a time.",
  },
  {
    id: "the-quiet-orbit",
    title: "The Quiet Orbit",
    kind: "movie",
    kids: false,
    year: 2019,
    genre: "Science Fiction",
    description: "The last crew of an old station decides who gets the seat on the way home.",
  },
  {
    id: "second-string",
    title: "Second String",
    kind: "show",
    kids: false,
    year: 2016,
    genre: "Sports",
    description: "A season with the reserves of a club that has not won since the seventies.",
  },
  {
    id: "the-morning-desk",
    title: "The Morning Desk",
    kind: "show",
    kids: false,
    year: 2019,
    genre: "Drama",
    description: "A breakfast programme loses its host an hour before it goes on air.",
  },
  {
    id: "tide-pool",
    title: "Tide Pool",
    kind: "movie",
    kids: true,
    year: 2017,
    genre: "Documentary",
    description: "One rock pool, filmed from one spring tide to the next.",
  },
  {
    id: "copper-and-glass",
    title: "Copper & Glass",
    kind: "movie",
    kids: false,
    year: 2016,
    genre: "Thriller",
    description: "A restorer finds a second painting under the one she was hired to clean.",
  },
  {
    id: "field-day",
    title: "Field Day",
    kind: "show",
    kids: true,
    year: 2018,
    genre: "Kids & Family",
    description: "A village school enters every event of the county games with eleven pupils.",
  },
];

/** The titles of the What to Watch shelf, in order: two pages of four. */
export const WHAT_TO_WATCH = [
  "harbour-lights",
  "paper-rockets",
  "the-long-table",
  "night-shift-diner",
  "signal-fires",
  "little-engines",
  "the-quiet-orbit",
  "second-string",
];

/** The titles the hero pages through. */
export const FEATURED = ["the-morning-desk", "the-quiet-orbit", "harbour-lights"];

/** The titles of the Watch New Trailers shelf: two pages of three. */
export const TRAILERS = [
  "copper-and-glass",
  "tide-pool",
  "field-day",
  "signal-fires",
  "paper-rockets",
  "second-string",
];

/** The titles with these ids that the catalogue holds, in the order of the ids. */
export function pick(titles: readonly TvTitle[], ids: readonly string[]): TvTitle[] {
  return ids.flatMap((id) => titles.find((title) => title.id === id) ?? []);
}

/** The titles a section lists. Watch Now and Library are composed by the window. */
export function inSection(titles: readonly TvTitle[], section: TvSection): TvTitle[] {
  if (section === "movies") return titles.filter((title) => title.kind === "movie");
  if (section === "tv-shows") return titles.filter((title) => title.kind === "show");
  if (section === "kids") return titles.filter((title) => title.kids);
  return [...titles];
}

/** Whether a title's name or genre contains what was typed, whatever its case. */
export function titleMatches(title: TvTitle, query: string): boolean {
  const needle = query.trim().toLowerCase();
  return (
    needle !== "" &&
    (title.title.toLowerCase().includes(needle) || title.genre.toLowerCase().includes(needle))
  );
}

/** What a title is, in one line: "Series · 2019 · Drama". */
export const summary = (title: TvTitle) =>
  `${title.kind === "movie" ? "Movie" : "Series"} · ${title.year} · ${title.genre}`;

/** The sizes of the List Size pop-up button. */
export type TvListSize = "small" | "medium" | "large";

/** The settings of the Preferences window's General pane. */
export interface TvSettings {
  /** Always check for available downloads. */
  checkDownloads: boolean;
  /** Show: Checkboxes in library. The Library section then has a checkbox under every title. */
  checkboxes: boolean;
  /** List Size: how wide the Library section's cards are. */
  listSize: TvListSize;
  /** Playback: use the screen saver while paused. */
  screenSaver: boolean;
  /** Files: keep the media folder organized. */
  keepOrganized: boolean;
  /** Restrictions: restrict films and series with mature content. */
  restrictMature: boolean;
  /** Advanced: reset the warnings of dialogs when the app starts. */
  resetWarnings: boolean;
  /** The videos whose Library checkbox is cleared: Up Next passes over them. */
  unchecked?: readonly string[];
}

/** The keys of the settings that a checkbox holds. */
export type TvSettingKey = Exclude<keyof TvSettings, "listSize" | "unchecked">;

/** The settings of the reference screenshots; the panes no capture shows start unchecked. */
export const defaultSettings: TvSettings = {
  checkDownloads: true,
  checkboxes: false,
  listSize: "medium",
  screenSaver: false,
  keepOrganized: false,
  restrictMature: false,
  resetWarnings: false,
};

/** The narrowest card of the Library section for each List Size, in points. */
export const LIBRARY_CARD_WIDTH: Readonly<Record<TvListSize, number>> = {
  small: 160,
  medium: 220,
  large: 288,
};
