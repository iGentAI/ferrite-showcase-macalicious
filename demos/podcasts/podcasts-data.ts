/**
 * The catalogue of the Podcasts demo. Every show, publisher and episode is invented for the
 * demo: none is a real podcast, and the artwork is drawn from two system colours.
 */

/** The rows of the sidebar. */
export type PodcastsSection =
  | "listen-now"
  | "browse"
  | "top-charts"
  | "recently-updated"
  | "shows"
  | "episodes"
  | "downloaded";

export interface PodcastsSectionGroup {
  /** The header of the group in the sidebar. */
  title: string;
  /** Its rows, from the top. */
  items: readonly { id: PodcastsSection; name: string }[];
}

/** The sidebar as the reference screenshots show it. */
export const SECTIONS: readonly PodcastsSectionGroup[] = [
  {
    title: "Apple Podcasts",
    items: [
      { id: "listen-now", name: "Listen Now" },
      { id: "browse", name: "Browse" },
      { id: "top-charts", name: "Top Charts" },
    ],
  },
  {
    title: "Library",
    items: [
      { id: "recently-updated", name: "Recently Updated" },
      { id: "shows", name: "Shows" },
      { id: "episodes", name: "Episodes" },
      { id: "downloaded", name: "Downloaded" },
    ],
  },
];

/** The name of a sidebar row. */
export function sectionName(section: PodcastsSection): string {
  for (const group of SECTIONS) {
    for (const item of group.items) if (item.id === section) return item.name;
  }
  return "";
}

/** A system colour by the name of its token, `--mac-color-system-<name>`. */
export type PodcastsColor =
  | "blue"
  | "green"
  | "indigo"
  | "orange"
  | "pink"
  | "purple"
  | "red"
  | "teal"
  | "yellow";

export interface PodcastsShow {
  /** Identifies the show. */
  id: string;
  title: string;
  /** Who publishes it. */
  author: string;
  category: string;
  /** What the show is about, on its page. */
  description: string;
  /** The two colours of its placeholder artwork. */
  colors: readonly [PodcastsColor, PodcastsColor];
  /** Whether the library follows the show at first. */
  subscribed: boolean;
  /**
   * The address of the show's cover, loaded by the browser. The demo's shows have none and
   * use their generated artwork; the shows the Ferrite desktop reads from Apple's directory
   * have one.
   */
  artwork?: string;
}

export interface PodcastsEpisode {
  /** Identifies the episode. */
  id: string;
  /** The `id` of its show. */
  show: string;
  title: string;
  description: string;
  /** The day it was published, as the display's second line gives it. */
  date: string;
  /** The same day as a card's caption gives it: a weekday or a short date. */
  day: string;
  /** Order of publication: a later episode has a larger number. */
  published: number;
  /** Length in seconds. */
  duration: number;
  /** Published since the library was last opened: the caption says `New`. */
  isNew?: boolean;
  /** Not played yet at first. Every other episode starts as played. */
  unplayed?: boolean;
  /**
   * The address of the episode's audio, played by the browser from its publisher. The demo's
   * episodes have none: their transport is a clock.
   */
  audio?: string;
}

export const defaultShows: readonly PodcastsShow[] = [
  {
    id: "signal-path",
    title: "Signal Path",
    author: "Rowan & Hale",
    category: "Technology",
    description:
      "Two friends take apart the tools they work with every day: what is worth setting up, what is not, and what they changed their minds about.",
    colors: ["indigo", "purple"],
    subscribed: true,
  },
  {
    id: "the-long-field",
    title: "The Long Field",
    author: "Marrow Audio",
    category: "Society & Culture",
    description:
      "Slow stories from small places: one village, one harvest, one ferry timetable at a time.",
    colors: ["green", "teal"],
    subscribed: true,
  },
  {
    id: "small-hours",
    title: "Small Hours",
    author: "Odile Brandt",
    category: "Arts",
    description: "Conversations with people who make things at night, recorded after closing time.",
    colors: ["pink", "orange"],
    subscribed: true,
  },
  {
    id: "ledger-lines",
    title: "Ledger Lines",
    author: "North Quay Radio",
    category: "Music",
    description: "One piece of music a week, played through and then pulled apart bar by bar.",
    colors: ["orange", "yellow"],
    subscribed: true,
  },
  {
    id: "tidewater",
    title: "Tidewater",
    author: "Coastline Collective",
    category: "Science",
    description: "Field recordings and field notes from the line where the land gives way.",
    colors: ["teal", "blue"],
    subscribed: false,
  },
  {
    id: "plain-sight",
    title: "Plain Sight",
    author: "Ines Okoro",
    category: "Documentary",
    description: "The histories of ordinary objects, from the paper clip to the park bench.",
    colors: ["red", "pink"],
    subscribed: false,
  },
  {
    id: "second-draft",
    title: "Second Draft",
    author: "Paper Lantern",
    category: "Books",
    description: "Writers read the page they threw away and explain what replaced it.",
    colors: ["purple", "pink"],
    subscribed: false,
  },
  {
    id: "open-hours",
    title: "Open Hours",
    author: "Field Office",
    category: "Business",
    description: "Shopkeepers, on the record, about the week they just had.",
    colors: ["blue", "indigo"],
    subscribed: false,
  },
];

export const defaultEpisodes: readonly PodcastsEpisode[] = [
  {
    id: "signal-path-12",
    show: "signal-path",
    title: "Notes From the Feedback Pile",
    description:
      "In this feedback episode, Rowan and Hale revisit launchers and backups and talk about a bumpy autumn release and the new phones",
    date: "September 29, 2019",
    day: "Sunday",
    published: 16,
    duration: 6360,
    isNew: true,
    unplayed: true,
  },
  {
    id: "signal-path-11",
    show: "signal-path",
    title: "A Drawer Full of Cables",
    description: "What to keep, what to label and what to finally take to the recycling point.",
    date: "September 22, 2019",
    day: "Sep 22",
    published: 12,
    duration: 4920,
  },
  {
    id: "the-long-field-8",
    show: "the-long-field",
    title: "The Last Ferry of the Season",
    description:
      "A crossing of eleven minutes, and the forty years one family has spent making it.",
    date: "September 27, 2019",
    day: "Friday",
    published: 15,
    duration: 2760,
    unplayed: true,
  },
  {
    id: "the-long-field-7",
    show: "the-long-field",
    title: "Windfall",
    description: "An orchard after a storm, and what its neighbours do with the apples.",
    date: "September 13, 2019",
    day: "Sep 13",
    published: 8,
    duration: 2520,
  },
  {
    id: "small-hours-31",
    show: "small-hours",
    title: "The Baker Who Paints",
    description: "Flour on the brushes, and why the ovens come first.",
    date: "September 26, 2019",
    day: "Thursday",
    published: 14,
    duration: 3480,
    unplayed: true,
  },
  {
    id: "small-hours-30",
    show: "small-hours",
    title: "Night Shift at the Print Shop",
    description: "Posters for a town that has not woken up yet.",
    date: "September 19, 2019",
    day: "Sep 19",
    published: 10,
    duration: 3300,
  },
  {
    id: "ledger-lines-54",
    show: "ledger-lines",
    title: "A Waltz in Five",
    description: "Three beats to the bar, except when there are five, and why nobody trips.",
    date: "September 25, 2019",
    day: "Wednesday",
    published: 13,
    duration: 1980,
  },
  {
    id: "ledger-lines-53",
    show: "ledger-lines",
    title: "The Held Note",
    description: "Forty seconds on one pitch and everything that moves underneath it.",
    date: "September 18, 2019",
    day: "Sep 18",
    published: 9,
    duration: 2100,
  },
  {
    id: "tidewater-19",
    show: "tidewater",
    title: "Spring Tide",
    description: "The highest water of the month, measured with a stick and a notebook.",
    date: "September 24, 2019",
    day: "Tuesday",
    published: 11,
    duration: 1620,
  },
  {
    id: "tidewater-18",
    show: "tidewater",
    title: "Salt Marsh at Dawn",
    description: "Twenty-seven minutes of a marsh waking, with notes on who is singing.",
    date: "September 10, 2019",
    day: "Sep 10",
    published: 6,
    duration: 1640,
  },
  {
    id: "plain-sight-5",
    show: "plain-sight",
    title: "The Park Bench",
    description: "Who decides how long a bench should be, and who it is for.",
    date: "September 12, 2019",
    day: "Sep 12",
    published: 7,
    duration: 2280,
  },
  {
    id: "plain-sight-4",
    show: "plain-sight",
    title: "The Paper Clip",
    description: "A piece of bent wire with four patents and no inventor.",
    date: "September 5, 2019",
    day: "Sep 5",
    published: 4,
    duration: 2160,
  },
  {
    id: "second-draft-22",
    show: "second-draft",
    title: "The Missing Chapter",
    description: "A novelist on the forty pages her editor was right about.",
    date: "September 9, 2019",
    day: "Sep 9",
    published: 5,
    duration: 3060,
  },
  {
    id: "second-draft-21",
    show: "second-draft",
    title: "First Lines",
    description: "Six openings for one story, read in the order they were written.",
    date: "September 2, 2019",
    day: "Sep 2",
    published: 2,
    duration: 2880,
  },
  {
    id: "open-hours-14",
    show: "open-hours",
    title: "The Bicycle Shop in October",
    description: "What sells when the weather turns, and what waits for spring.",
    date: "September 3, 2019",
    day: "Sep 3",
    published: 3,
    duration: 1860,
  },
  {
    id: "open-hours-13",
    show: "open-hours",
    title: "Counting the Till",
    description: "A stationer closes the week and reads out the numbers.",
    date: "August 27, 2019",
    day: "Aug 27",
    published: 1,
    duration: 1740,
  },
];

/** The shows of Top Charts, from the first place down. */
export const TOP_SHOWS: readonly string[] = [
  "plain-sight",
  "signal-path",
  "tidewater",
  "small-hours",
  "open-hours",
  "the-long-field",
  "second-draft",
  "ledger-lines",
];

/** The shows of Browse's first shelf. */
export const FEATURED_SHOWS: readonly string[] = [
  "tidewater",
  "second-draft",
  "plain-sight",
  "open-hours",
];

/** What the General, Playback and Advanced panes of Preferences hold. */
export interface PodcastsSettings {
  /** How often the library looks for new episodes. Nothing is fetched: the choice is kept. */
  refresh: string;
  /** Which episodes of the followed shows the Downloaded row lists. */
  download: string;
  /** Seconds the skip-forward button moves. */
  skipForward: number;
  /** Seconds the skip-back button moves. */
  skipBack: number;
  /** Whether the next episode of the queue starts when one ends. */
  continuous: boolean;
  /** Whether subscriptions are shared with other devices. There are none: the choice is kept. */
  sync: boolean;
}

export const REFRESH_CHOICES = [
  "Every Hour",
  "Every 6 Hours",
  "Every Day",
  "Every Week",
  "Manually",
] as const;

export const DOWNLOAD_CHOICES = ["Only New", "All Unplayed", "Never"] as const;

export const SKIP_CHOICES = [10, 15, 30, 45, 60] as const;

/** The settings of the reference screenshots. */
export const DEFAULT_SETTINGS: PodcastsSettings = {
  refresh: "Every Hour",
  download: "Only New",
  skipForward: 30,
  skipBack: 15,
  continuous: true,
  sync: true,
};

/** A length as a card's footnote gives it: `1h 46m`, `58m`. */
export function formatDuration(seconds: number): string {
  const minutes = Math.max(1, Math.round(seconds / 60));
  const hours = Math.floor(minutes / 60);
  return hours ? `${hours}h ${minutes % 60}m` : `${minutes}m`;
}

/** What is left of an episode as a card's caption gives it: `1 hr 46 min left`. */
export function formatRemaining(seconds: number): string {
  const minutes = Math.max(1, Math.round(seconds / 60));
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  if (!hours) return `${minutes} min left`;
  return rest ? `${hours} hr ${rest} min left` : `${hours} hr left`;
}

const contains = (text: string, query: string) =>
  text.toLowerCase().includes(query.trim().toLowerCase());

/** Whether a search finds the show: in its title, its publisher or its category. */
export function showMatches(show: PodcastsShow, query: string): boolean {
  return contains(`${show.title}\n${show.author}\n${show.category}`, query);
}

/** Whether a search finds the episode: in its title or its description. */
export function episodeMatches(episode: PodcastsEpisode, query: string): boolean {
  return contains(`${episode.title}\n${episode.description}`, query);
}
