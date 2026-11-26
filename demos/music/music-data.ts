/** One song of an album. */
export interface MusicSong {
  /** Identifies the song in the library. */
  id: string;
  /** The song's title. */
  title: string;
  /** Its length in seconds. */
  duration: number;
}

/** What the placeholder cover of an album is drawn from: two neutral colours and a motif. */
export interface MusicCover {
  /** Fill of the cover. */
  ground: string;
  /** Colour of the motif drawn on it. */
  ink: string;
  /** The drawing. */
  motif: "rings" | "bars" | "hill" | "grid" | "wave" | "sun";
}

/** One album of the library. */
export interface MusicAlbum {
  /** Identifies the album in the library. */
  id: string;
  /** The album's title. */
  title: string;
  /** The artist's name. */
  artist: string;
  /** The genre shown in the album's details and the Songs list. */
  genre: string;
  /** The year of release. */
  year: number;
  /** When it was added, as days before today: Recently Added lists the smallest first. */
  added: number;
  /** Its placeholder cover. */
  cover: MusicCover;
  /**
   * The address of its real cover, which replaces the placeholder: a cover read from an
   * uploaded song, or an Internet Archive item's picture, on the Ferrite desktop.
   */
  artwork?: string;
  /** Its songs, in track order. */
  songs: MusicSong[];
}

/** A song with the album it is on: one entry of the play queue and one row of the Songs list. */
export interface MusicTrack {
  /** The song. */
  song: MusicSong;
  /** The album it is on. */
  album: MusicAlbum;
}

/** The rows of the sidebar: the places of the app. */
export type MusicSection =
  | "for-you"
  | "browse"
  | "radio"
  | "recently-added"
  | "artists"
  | "albums"
  | "songs"
  | "itunes-store";

/** The sidebar's groups and rows, as in the reference screenshots. */
export const SECTIONS: readonly {
  title: string;
  items: readonly { id: MusicSection; name: string }[];
}[] = [
  {
    title: "Apple Music",
    items: [
      { id: "for-you", name: "For You" },
      { id: "browse", name: "Browse" },
      { id: "radio", name: "Radio" },
    ],
  },
  {
    title: "Library",
    items: [
      { id: "recently-added", name: "Recently Added" },
      { id: "artists", name: "Artists" },
      { id: "albums", name: "Albums" },
      { id: "songs", name: "Songs" },
    ],
  },
  { title: "Store", items: [{ id: "itunes-store", name: "iTunes Store" }] },
];

function album(
  id: string,
  title: string,
  artist: string,
  genre: string,
  year: number,
  added: number,
  cover: MusicCover,
  songs: [title: string, duration: number][],
): MusicAlbum {
  return {
    id,
    title,
    artist,
    genre,
    year,
    added,
    cover,
    songs: songs.map(([name, duration], index) => ({
      id: `${id}-${index + 1}`,
      title: name,
      duration,
    })),
  };
}

/**
 * The library the demo starts with. Every album, artist and song is invented for the demo, and
 * the covers are drawn placeholders: nothing here is a real recording.
 */
export const defaultAlbums: MusicAlbum[] = [
  album(
    "night-lines",
    "Night Lines",
    "The Placeholders",
    "Rock",
    2014,
    40,
    { ground: "#1c1c1c", ink: "#3a3a3a", motif: "rings" },
    [
      ["Streetlight Hours", 194],
      ["Paper Maps", 221],
      ["Last Train Home", 247],
      ["Night Lines", 263],
    ],
  ),
  album(
    "morning-walk",
    "Morning Walk",
    "The Placeholders",
    "Rock",
    2016,
    12,
    { ground: "#d9d4c8", ink: "#a79f8c", motif: "sun" },
    [
      ["Morning Walk", 215],
      ["Open Windows", 188],
      ["Kettle Song", 172],
      ["Long Way Round", 301],
    ],
  ),
  album(
    "paper-lanterns",
    "Paper Lanterns",
    "Ada Rowan",
    "Folk",
    2018,
    3,
    { ground: "#8d7b6a", ink: "#c9b8a4", motif: "hill" },
    [
      ["Paper Lanterns", 203],
      ["River Stones", 236],
      ["Winter Orchard", 219],
      ["Lamplight", 178],
    ],
  ),
  album(
    "slow-tide",
    "Slow Tide",
    "Ada Rowan",
    "Folk",
    2019,
    30,
    { ground: "#51626b", ink: "#8fa3ad", motif: "wave" },
    [
      ["Slow Tide", 251],
      ["Salt and Thread", 207],
      ["Harbour Bell", 229],
    ],
  ),
  album(
    "signal-and-static",
    "Signal and Static",
    "Quiet Machines",
    "Electronic",
    2017,
    21,
    { ground: "#2f3440", ink: "#6b7689", motif: "bars" },
    [
      ["Carrier Wave", 318],
      ["Signal and Static", 274],
      ["Test Pattern", 242],
      ["Sleep Mode", 356],
    ],
  ),
  album(
    "low-sun",
    "Low Sun",
    "Quiet Machines",
    "Electronic",
    2019,
    7,
    { ground: "#b9a48c", ink: "#7d6a55", motif: "sun" },
    [
      ["Low Sun", 286],
      ["Afterimage", 233],
      ["Golden Hour Loop", 305],
    ],
  ),
  album(
    "glass-harbor",
    "Glass Harbor",
    "North Cable",
    "Jazz",
    2015,
    55,
    { ground: "#a9b3b5", ink: "#6e7b7e", motif: "grid" },
    [
      ["Glass Harbor", 342],
      ["Blue Ferry", 297],
      ["Quarter Past", 264],
      ["Closing Time", 388],
    ],
  ),
  album(
    "orchard-road",
    "Orchard Road",
    "Mila Fenn",
    "Pop",
    2019,
    1,
    { ground: "#c7b9bd", ink: "#8f7a80", motif: "hill" },
    [
      ["Orchard Road", 198],
      ["Postcards", 184],
      ["Second Summer", 211],
      ["Nightbus", 226],
    ],
  ),
];

/** Every song of the albums with its album, in album and track order. */
export function tracksOf(albums: readonly MusicAlbum[]): MusicTrack[] {
  return albums.flatMap((entry) => entry.songs.map((song) => ({ song, album: entry })));
}

/** Whether the text contains the query, ignoring case and surrounding space. */
function contains(text: string, query: string): boolean {
  return text.toLowerCase().includes(query.trim().toLowerCase());
}

/** Whether the search finds the album: by its title or its artist. */
export function albumMatches(entry: MusicAlbum, query: string): boolean {
  return contains(entry.title, query) || contains(entry.artist, query);
}

/** Whether the search finds the song: by its title, its artist or its album. */
export function trackMatches(track: MusicTrack, query: string): boolean {
  return contains(track.song.title, query) || albumMatches(track.album, query);
}

/** A length in seconds as the Songs list shows it: `3:14`. */
export function formatDuration(seconds: number): string {
  const whole = Math.max(0, Math.round(seconds));
  return `${Math.floor(whole / 60)}:${String(whole % 60).padStart(2, "0")}`;
}

/** The choices of the List Size pop-up button: how tall the rows of the song lists are. */
export type MusicListSize = "small" | "medium" | "large";

/** Row pitch of the song lists in points, by list size. */
export const LIST_ROW_HEIGHT: Readonly<Record<MusicListSize, number>> = {
  small: 20,
  medium: 24,
  large: 28,
};

/** The settings of the Preferences window: the checkboxes by key, and the list size. */
export type MusicSettings = Readonly<
  Record<MusicSettingKey, boolean> & {
    listSize: MusicListSize;
    /** How long a crossfade lasts, in seconds. */
    crossfadeSeconds: number;
    /** How much Sound Enhancer does, from 0 (Low) to 100 (High). */
    soundEnhancerLevel: number;
  }
>;

/** The keys of the settings that are checkboxes. */
export type MusicSettingKey =
  | "showStore"
  | "starRatings"
  | "songCheckboxes"
  | "notifications"
  | "crossfade"
  | "soundEnhancer"
  | "soundCheck"
  | "keepOrganized"
  | "copyFiles"
  | "restrictStore"
  | "restrictShared"
  | "restrictExplicit"
  | "addToLibrary"
  | "updateArtwork"
  | "miniPlayerOnTop";

/** The settings as the reference screenshots show them; the panes without one are plausible. */
export const defaultSettings: MusicSettings = {
  showStore: true,
  starRatings: false,
  songCheckboxes: false,
  listSize: "medium",
  notifications: true,
  crossfade: false,
  crossfadeSeconds: 6,
  soundEnhancer: true,
  soundEnhancerLevel: 50,
  soundCheck: false,
  keepOrganized: true,
  copyFiles: true,
  restrictStore: false,
  restrictShared: false,
  restrictExplicit: false,
  addToLibrary: true,
  updateArtwork: true,
  miniPlayerOnTop: false,
};
