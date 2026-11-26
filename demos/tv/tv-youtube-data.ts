/*
 * TV's YouTube library: the videos a person knows, what they opened (History), what plays next
 * (Up Next), what they keep for later (Watch Later) and where they stopped in each started video.
 * Every function is pure; the window owns the state and the server keeps it
 * (`ferrite-apps/desktop/src/apps/tv`).
 *
 * Videos are played by YouTube's own embedded player. Nothing is downloaded or kept but ids,
 * titles, channel names and times; the pictures are YouTube's own thumbnails, loaded by the
 * browser from YouTube.
 */

/** A YouTube video the library knows. */
export interface TvVideo {
  /** YouTube's 11-character video id. */
  id: string;
  title: string;
  /** The channel that published it; empty when unknown. */
  channel: string;
}

/** A video opened, and when (epoch milliseconds). */
export interface TvWatched {
  id: string;
  at: number;
}

/** What the server keeps. Every id the lists name is one of `videos`. */
export interface TvLibraryState {
  videos: readonly TvVideo[];
  /** Newest first, one entry per video. */
  history: readonly TvWatched[];
  upNext: readonly string[];
  watchLater: readonly string[];
  /** Whole seconds into each started video. */
  positions: Readonly<Record<string, number>>;
  /** The lists the person made. */
  playlists: readonly TvPlaylist[];
  /** The files of the person's drive in the Library, oldest first. */
  homeVideos: readonly TvHomeVideo[];
  /** The Genre set in Get Info, by the id of a video or a home video. */
  genres: Readonly<Record<string, string>>;
}

/** A file of the person's drive in the Library: its name and bytes stay in the drive. */
export interface TvHomeVideo {
  /** The drive's id of the file. */
  id: string;
  /** Whole seconds in, where the person stopped; 0 at the start. */
  place: number;
}

/** A list the person made and named. */
export interface TvPlaylist {
  id: string;
  name: string;
  videos: readonly string[];
}

/** The limits the server holds the library to (`src/apps/tv/mod.rs`). */
export const LIMITS = {
  videos: 1000,
  history: 200,
  upNext: 200,
  watchLater: 500,
  positions: 1000,
  position: 604_800,
  title: 300,
  channel: 200,
  query: 100,
  playlists: 50,
  playlistVideos: 200,
  playlistEntries: 1000,
  playlistName: 100,
  homeVideos: 200,
  genres: 500,
  genre: 40,
  /** The bytes of the saved library, as JSON (the store keeps values up to 200 KB). */
  bytes: 190_000,
} as const;

/**
 * Room kept free for the lists when a video is added: History, Up Next, Watch Later, the places,
 * the playlists and the home videos at their limits take under 76 KB together, so a library that has
 * room for them never grows past `LIMITS.bytes` as they fill.
 */
const LIST_ROOM = 76_000;

/** The bytes the library takes as the server keeps it. */
export function libraryBytes(library: TvLibraryState): number {
  return new TextEncoder().encode(JSON.stringify(tvLibraryToServer(library).library)).length;
}

/** While a video plays its place is kept to this many seconds: one save per step. */
export const POSITION_STEP = 10;
/** A video this close to its end counts as watched: its place is forgotten. */
export const FINISHED_WITHIN = 15;

export const emptyLibrary: TvLibraryState = {
  videos: [],
  history: [],
  upNext: [],
  watchLater: [],
  positions: {},
  playlists: [],
  homeVideos: [],
  genres: {},
};

/**
 * Open films of the Blender Foundation and Blender Studio, published by them on YouTube under
 * Creative Commons licences. Each id was checked against YouTube's oEmbed endpoint.
 */
export const OPEN_MOVIES: readonly TvVideo[] = [
  { id: "eRsGyueVLvQ", title: "Sintel", channel: "Blender" },
  { id: "R6MlUcmOul8", title: "Tears of Steel", channel: "Blender" },
  { id: "WhWc3b3KhnY", title: "Spring", channel: "Blender Studio" },
  { id: "Y-rmzh0PI3c", title: "Cosmos Laundromat", channel: "Blender" },
  { id: "mN0zPOpADL4", title: "Agent 327: Operation Barbershop", channel: "Blender Studio" },
  { id: "UXqq0ZvbOnk", title: "Charge", channel: "Blender Studio" },
];

/** Open films for children, from the same channels. */
export const OPEN_KIDS: readonly TvVideo[] = [
  { id: "aqz-KE-bpKQ", title: "Big Buck Bunny", channel: "Blender" },
  { id: "SkVqJ1SGeL0", title: "Caminandes 3: Llamigos", channel: "Blender" },
];

/** Watch Now's shelf of everything that is not a series. */
export const FOR_EVERYONE: readonly TvVideo[] = [...OPEN_KIDS, ...OPEN_MOVIES];

export interface TvShow {
  title: string;
  episodes: readonly TvVideo[];
}

/**
 * Open series their makers publish on YouTube under Creative Commons licences. Only the episodes
 * on the makers' own channels are listed, checked against YouTube's oEmbed endpoint; Caminandes 1
 * and Pepper & Carrot 1 and 2 were not found there.
 */
export const OPEN_SHOWS: readonly TvShow[] = [
  {
    title: "Caminandes",
    episodes: [
      { id: "Z4C82eyhwgU", title: "Caminandes 2: Gran Dillama", channel: "Blender" },
      { id: "SkVqJ1SGeL0", title: "Caminandes 3: Llamigos", channel: "Blender" },
    ],
  },
  {
    title: "Pepper & Carrot",
    episodes: [
      {
        id: "nuw1B334feI",
        title: "Pepper & Carrot 3: The Secret Ingredients",
        channel: "Morevna Project",
      },
      {
        id: "-wWIZ7wT8eg",
        title: "Pepper & Carrot 4: Stroke of Genius",
        channel: "Morevna Project",
      },
      {
        id: "v6-r01Jb_HM",
        title: "Pepper & Carrot 5: Holiday Special",
        channel: "Morevna Project",
      },
      {
        id: "cTb1_w8hvqY",
        title: "Pepper & Carrot 6: The Potion Contest",
        channel: "Morevna Project",
      },
    ],
  },
  {
    title: "Morevna",
    episodes: [
      { id: "ecVv2IB7f5k", title: "Morevna: Episode 3", channel: "Morevna Project" },
      { id: "PqEY8hsCNcs", title: "Morevna: Episode 4", channel: "Morevna Project" },
    ],
  },
];

/** Every video the window offers before the person adds any. */
export const BUILT_IN: readonly TvVideo[] = [
  ...FOR_EVERYONE,
  ...OPEN_SHOWS.flatMap((show) => show.episodes).filter(
    (episode) => !FOR_EVERYONE.some((video) => video.id === episode.id),
  ),
];

/** The episode after `id` in its series whose checkbox is not cleared, if `id` is an episode. */
export function nextEpisodeId(id: string, unchecked: readonly string[] = []): string | undefined {
  for (const { episodes } of OPEN_SHOWS) {
    const at = episodes.findIndex((episode) => episode.id === id);
    if (at >= 0) return episodes.slice(at + 1).find((each) => !unchecked.includes(each.id))?.id;
  }
  return undefined;
}

/** Whether `id` is a YouTube video id: 11 letters, digits, `-` or `_`. */
export const isVideoId = (id: string) => /^[A-Za-z0-9_-]{11}$/.test(id);

/**
 * The video id a YouTube link names, or the id itself: `youtube.com/watch?v=`, `youtu.be/`,
 * `/embed/`, `/shorts/`, `/live/` and `/v/` on youtube.com, m.youtube.com, music.youtube.com and
 * youtube-nocookie.com. `undefined` for anything else. The server reads links by the same rules.
 */
export function youTubeVideoId(text: string): string | undefined {
  const link = text.trim();
  if (isVideoId(link)) return link;
  let url: URL;
  try {
    url = new URL(/^https?:\/\//i.test(link) ? link : `https://${link}`);
  } catch {
    return undefined;
  }
  const host = url.hostname.toLowerCase().replace(/^(www|m|music)\./, "");
  const segments = url.pathname.split("/").filter(Boolean);
  let id: string | undefined;
  if (host === "youtu.be") id = segments[0];
  else if (host === "youtube.com" || host === "youtube-nocookie.com") {
    if (segments.length === 1 && segments[0] === "watch") {
      // The raw query: the server reads `v=` undecoded, so a percent-escape is no id here either.
      id = url.search
        .slice(1)
        .split("&")
        .find((pair) => pair.startsWith("v="))
        ?.slice(2);
    } else if (["embed", "shorts", "live", "v"].includes(segments[0] ?? "")) id = segments[1];
  }
  return id && isVideoId(id) ? id : undefined;
}

/** YouTube's own 16:9 thumbnail of a video, loaded by the browser. */
export const thumbnailUrl = (id: string, size: "card" | "hero" = "card") =>
  `https://i.ytimg.com/vi/${id}/${size === "hero" ? "hqdefault" : "mqdefault"}.jpg`;

/** The video's page on YouTube, for when it cannot be played here. */
export const watchUrl = (id: string) => `https://www.youtube.com/watch?v=${id}`;

/** Whether a character is a control character (C0, DEL or C1). */
const isControl = (character: string) => {
  const code = character.codePointAt(0) ?? 0;
  return code < 0x20 || (code >= 0x7f && code <= 0x9f);
};

/** A video's title and channel as kept: trimmed to the server's limits, without control characters. */
export function cleanVideo(video: TvVideo): TvVideo {
  const plain = (text: string, max: number) =>
    [...text]
      .filter((character) => !isControl(character))
      .slice(0, max)
      .join("");
  const title = plain(video.title, LIMITS.title).trim();
  return {
    id: video.id,
    title: title || "YouTube video",
    channel: plain(video.channel, LIMITS.channel).trim(),
  };
}

/** The library's video with this id, or a built-in one. */
export function findVideo(library: TvLibraryState, id: string): TvVideo | undefined {
  return (
    library.videos.find((video) => video.id === id) ?? BUILT_IN.find((video) => video.id === id)
  );
}

/** The ids the library's lists name. */
function referenced(library: TvLibraryState): Set<string> {
  return new Set([
    ...library.history.map((entry) => entry.id),
    ...library.upNext,
    ...library.watchLater,
    ...library.playlists.flatMap((playlist) => playlist.videos),
    ...Object.keys(library.positions),
    ...Object.keys(library.genres),
  ]);
}

/** The library without the video `id`, and without it in History, Up Next, Watch Later and the
 * places. */
function forget(library: TvLibraryState, id: string): TvLibraryState {
  const { [id]: _place, ...positions } = library.positions;
  return {
    ...withoutGenres(library, [id]),
    videos: library.videos.filter((video) => video.id !== id),
    history: library.history.filter((entry) => entry.id !== id),
    upNext: library.upNext.filter((queued) => queued !== id),
    watchLater: library.watchLater.filter((kept) => kept !== id),
    positions,
    playlists: library.playlists.map((playlist) => ({
      ...playlist,
      videos: playlist.videos.filter((listed) => listed !== id),
    })),
  };
}

/**
 * `library` with room made among its videos other than `keep`, until `full` no longer holds: the
 * oldest one no list names goes, or, when every one is listed, the oldest one together with its
 * entries in the lists, so that no list ever names a video the library does not know.
 */
function makeRoom(
  library: TvLibraryState,
  keep: string,
  full: (state: TvLibraryState) => boolean,
): TvLibraryState {
  let room = library;
  while (full(room)) {
    const used = referenced(room);
    const others = room.videos.filter((known) => known.id !== keep);
    const spare = others.find((known) => !used.has(known.id)) ?? others[0];
    if (!spare) break;
    room = forget(room, spare.id);
  }
  return room;
}

/** Whether the saved library would leave too little room for the lists to fill. */
const overBudget = (state: TvLibraryState) => libraryBytes(state) > LIMITS.bytes - LIST_ROOM;

/**
 * The library with `video` known (its title and channel updated when it was known already). At
 * the limit, of videos or of bytes, room is made among the videos already known, never by letting
 * `video` go (`makeRoom`). A longer title replacing a short one counts against the bytes as an
 * addition does.
 */
export function know(library: TvLibraryState, video: TvVideo): TvLibraryState {
  const clean = cleanVideo(video);
  const at = library.videos.findIndex((known) => known.id === clean.id);
  if (at >= 0) {
    const known = library.videos[at];
    if (known?.title === clean.title && known.channel === clean.channel) return library;
    // A title YouTube gave replaces a placeholder; a placeholder never replaces a title.
    if (clean.title === "YouTube video" && known) return library;
    const updated = {
      ...library,
      videos: library.videos.map((other) => (other.id === clean.id ? clean : other)),
    };
    return makeRoom(updated, clean.id, overBudget);
  }
  // Room for one more, by count and by bytes.
  const room = makeRoom(
    library,
    clean.id,
    (state) =>
      state.videos.length >= LIMITS.videos ||
      overBudget({ ...state, videos: [...state.videos, clean] }),
  );
  return { ...room, videos: [...room.videos, clean] };
}

/** The library after `video` was opened at `at`: first in History, once. */
export function opened(library: TvLibraryState, video: TvVideo, at: number): TvLibraryState {
  const known = know(library, video);
  const history = [
    { id: video.id, at },
    ...known.history.filter((entry) => entry.id !== video.id),
  ].slice(0, LIMITS.history);
  return { ...known, history };
}

/** Watch Later with `video` added, or taken out when it is there. */
export function toggleWatchLater(library: TvLibraryState, video: TvVideo): TvLibraryState {
  if (library.watchLater.includes(video.id)) {
    return { ...library, watchLater: library.watchLater.filter((id) => id !== video.id) };
  }
  const known = know(library, video);
  return {
    ...known,
    watchLater: [video.id, ...known.watchLater].slice(0, LIMITS.watchLater),
  };
}

/** Up Next with `video` at its end (`"last"`) or first (`"next"`), once. At the limit the video
 * is kept and an entry already queued makes room: the last one for `"next"`, the one queued
 * earliest for `"last"`. */
export function queue(
  library: TvLibraryState,
  video: TvVideo,
  where: "next" | "last" = "last",
): TvLibraryState {
  const known = know(library, video);
  const rest = known.upNext.filter((id) => id !== video.id);
  const room = LIMITS.upNext - 1;
  const upNext =
    where === "next"
      ? [video.id, ...rest.slice(0, room)]
      : [...rest.slice(Math.max(0, rest.length - room)), video.id];
  return { ...known, upNext };
}

/** Up Next without `id`. */
export function unqueue(library: TvLibraryState, id: string): TvLibraryState {
  return library.upNext.includes(id)
    ? { ...library, upNext: library.upNext.filter((queued) => queued !== id) }
    : library;
}

/**
 * Up Next with `video` just before `before`, or last when `before` is `null` or not queued, once.
 * At the limit the entry nearest the end makes room.
 */
export function queueBefore(
  library: TvLibraryState,
  video: TvVideo,
  before: string | null,
): TvLibraryState {
  const known = know(library, video);
  if (before === video.id) return known;
  const rest = known.upNext.filter((id) => id !== video.id);
  const at = before === null ? -1 : rest.indexOf(before);
  const upNext = at < 0 ? [...rest, video.id] : [...rest.slice(0, at), video.id, ...rest.slice(at)];
  if (upNext.length > LIMITS.upNext) {
    upNext.splice(
      upNext[upNext.length - 1] === video.id ? upNext.length - 2 : upNext.length - 1,
      1,
    );
  }
  return { ...known, upNext };
}

/** Why no playlist can be added now, or `undefined` when one can. */
export const noNewPlaylist = (library: TvLibraryState): string | undefined =>
  library.playlists.length >= LIMITS.playlists
    ? `You have ${LIMITS.playlists} playlists, the most this library keeps.`
    : undefined;

/** Why `video` cannot join the playlist, or `undefined` when it can. */
export function noRoomInPlaylist(
  library: TvLibraryState,
  id: string,
  video: string,
): string | undefined {
  const playlist = library.playlists.find((each) => each.id === id);
  if (!playlist || playlist.videos.includes(video)) return undefined;
  if (playlist.videos.length >= LIMITS.playlistVideos) {
    return `“${playlist.name}” holds ${LIMITS.playlistVideos} videos, the most a playlist keeps.`;
  }
  const entries = library.playlists.reduce((sum, each) => sum + each.videos.length, 0);
  return entries >= LIMITS.playlistEntries
    ? `Your playlists hold ${LIMITS.playlistEntries} videos together, the most this library keeps.`
    : undefined;
}

/** The library made to fit what the server takes, after a playlist change: only as much room as
 * that needs goes (`makeRoom`), since a saved library may be near the limit already. */
const fitted = (library: TvLibraryState, keep = "") =>
  makeRoom(library, keep, (state) => libraryBytes(state) > LIMITS.bytes);

/** The library with a new playlist holding `videos`, the ones it has room for. */
export function addPlaylist(
  library: TvLibraryState,
  id: string,
  name: string,
  videos: readonly TvVideo[] = [],
): TvLibraryState {
  if (noNewPlaylist(library)) return library;
  const made = fitted({
    ...library,
    playlists: [
      ...library.playlists,
      { id, name: cleanPlaylistName(name), videos: [] as readonly string[] },
    ],
  });
  return videos.reduce<TvLibraryState>((held, video) => addToPlaylist(held, id, video), made);
}

/** A name as the server keeps it: without control characters, trimmed, at most its limit. */
export function cleanPlaylistName(name: string): string {
  return Array.from(
    // biome-ignore lint/suspicious/noControlCharactersInRegex: control characters are what it removes.
    name.replace(/[\u0000-\u001f\u007f-\u009f]/g, "").trim(),
  )
    .slice(0, LIMITS.playlistName)
    .join("");
}

export const renamePlaylist = (library: TvLibraryState, id: string, name: string): TvLibraryState =>
  fitted({
    ...library,
    playlists: library.playlists.map((playlist) =>
      playlist.id === id ? { ...playlist, name: cleanPlaylistName(name) } : playlist,
    ),
  });

export const deletePlaylist = (library: TvLibraryState, id: string): TvLibraryState => ({
  ...library,
  playlists: library.playlists.filter((playlist) => playlist.id !== id),
});

/**
 * The playlist with `video` just before `before`, or last when `before` is `null` or not in it, once.
 * A playlist with no room takes no new video (`noRoomInPlaylist` says why).
 */
export function addToPlaylist(
  library: TvLibraryState,
  id: string,
  video: TvVideo,
  before: string | null = null,
): TvLibraryState {
  if (noRoomInPlaylist(library, id, video.id) || before === video.id) return library;
  const known = know(library, video);
  return fitted(
    {
      ...known,
      playlists: known.playlists.map((playlist) => {
        if (playlist.id !== id) return playlist;
        const rest = playlist.videos.filter((listed) => listed !== video.id);
        const at = before === null ? -1 : rest.indexOf(before);
        return {
          ...playlist,
          videos:
            at < 0 ? [...rest, video.id] : [...rest.slice(0, at), video.id, ...rest.slice(at)],
        };
      }),
    },
    video.id,
  );
}

export const removeFromPlaylist = (
  library: TvLibraryState,
  id: string,
  video: string,
): TvLibraryState => ({
  ...library,
  playlists: library.playlists.map((playlist) =>
    playlist.id === id
      ? { ...playlist, videos: playlist.videos.filter((listed) => listed !== video) }
      : playlist,
  ),
});

/** iTunes Store's movie genres: what Get Info's Genre offers besides those already in the library. */
export const STORE_GENRES: readonly string[] = [
  "Action & Adventure",
  "Anime",
  "Classics",
  "Comedy",
  "Documentary",
  "Drama",
  "Foreign",
  "Horror",
  "Independent",
  "Kids & Family",
  "Musicals",
  "Romance",
  "Sci-Fi & Fantasy",
  "Short Films",
  "Special Interest",
  "Thriller",
  "Western",
];

const byName = (a: string, b: string) => a.localeCompare(b, undefined, { sensitivity: "base" });

/** A genre as the server keeps it: without control characters, trimmed, at most its limit. */
export function cleanGenre(genre: string): string {
  return Array.from(
    // biome-ignore lint/suspicious/noControlCharactersInRegex: control characters are what it removes.
    genre.replace(/[\u0000-\u001f\u007f-\u009f]/g, "").trim(),
  )
    .slice(0, LIMITS.genre)
    .join("")
    .trim();
}

function withoutGenres(library: TvLibraryState, ids: readonly string[]): TvLibraryState {
  if (!ids.some((id) => id in library.genres)) return library;
  return {
    ...library,
    genres: Object.fromEntries(Object.entries(library.genres).filter(([id]) => !ids.includes(id))),
  };
}

/** The library with `id`'s Genre set, or cleared by an empty one. A genre the library has in another
 * case takes that spelling, so that it stays one row of the Library's list. */
export function withGenre(library: TvLibraryState, id: string, genre: string): TvLibraryState {
  const clean = cleanGenre(genre);
  if (!clean) return withoutGenres(library, [id]);
  const spelled = Object.values(library.genres).find((each) => byName(each, clean) === 0) ?? clean;
  return { ...library, genres: { ...library.genres, [id]: spelled } };
}

/** Why `id` cannot take this Genre, or `undefined` when it can. */
export function noRoomForGenre(
  library: TvLibraryState,
  id: string,
  genre: string,
): string | undefined {
  if (!cleanGenre(genre)) return undefined;
  if (!(id in library.genres) && Object.keys(library.genres).length >= LIMITS.genres) {
    return `${LIMITS.genres} videos have a genre, the most this library keeps.`;
  }
  return overBudget(withGenre(library, id, genre))
    ? "This library has no room left for this genre."
    : undefined;
}

/** The Library's list of genres, by name, of the ids that `shown` lets through. */
export function genreNames(library: TvLibraryState, shown: (id: string) => boolean): string[] {
  const names = Object.entries(library.genres).flatMap(([id, genre]) => (shown(id) ? [genre] : []));
  return [...new Set(names)].sort(byName);
}

/** What Get Info's Genre offers: the store's genres and the library's own, by name. */
export function genreChoices(library: TvLibraryState): string[] {
  const own = Object.values(library.genres);
  return [...new Set([...STORE_GENRES, ...own])].sort(byName);
}

/** Why no home video can be added now, or `undefined` when one can. */
export const noNewHomeVideo = (library: TvLibraryState): string | undefined =>
  library.homeVideos.length >= LIMITS.homeVideos
    ? `You have ${LIMITS.homeVideos} home videos, the most this library keeps.`
    : undefined;

/** The library with the drive file `id` among its home videos, once, while it has room. */
export function addHomeVideo(library: TvLibraryState, id: string): TvLibraryState {
  if (library.homeVideos.some((video) => video.id === id) || noNewHomeVideo(library)) {
    return library;
  }
  return fitted({ ...library, homeVideos: [...library.homeVideos, { id, place: 0 }] });
}

/** The library without the home videos `ids`, which the drive no longer has. */
export const forgetHomeVideos = (
  library: TvLibraryState,
  ids: readonly string[],
): TvLibraryState => {
  const homeVideos = library.homeVideos.filter((video) => !ids.includes(video.id));
  return homeVideos.length === library.homeVideos.length
    ? library
    : { ...withoutGenres(library, ids), homeVideos };
};

/**
 * The library with as many of the drive files `ids` as it has room for, each taking the room the
 * one before left, and those it had no room for.
 */
export function admitHomeVideos(
  library: TvLibraryState,
  ids: readonly string[],
): { library: TvLibraryState; refused: string[] } {
  const refused: string[] = [];
  let kept = library;
  for (const id of ids) {
    kept = addHomeVideo(kept, id);
    if (!kept.homeVideos.some((video) => video.id === id)) refused.push(id);
  }
  return { library: kept, refused };
}

/** The Library without the home video `id`; the file stays in the drive. */
export const removeHomeVideo = (library: TvLibraryState, id: string): TvLibraryState => ({
  ...withoutGenres(library, [id]),
  homeVideos: library.homeVideos.filter((video) => video.id !== id),
});

/** The home video's place, kept to the step while it plays and exactly when paused. A home video is
 * often short, so it counts as watched only in its last tenth, or its last `FINISHED_WITHIN` seconds
 * when those are fewer. */
export function placeHomeVideo(
  library: TvLibraryState,
  id: string,
  seconds: number,
  duration: number,
  playing: boolean,
): TvLibraryState {
  const whole = Math.min(LIMITS.position, Math.max(0, Math.floor(seconds)));
  const done = duration > 0 && seconds >= duration - Math.min(FINISHED_WITHIN, duration / 10);
  const place = done ? 0 : playing ? whole - (whole % POSITION_STEP) : whole;
  const at = library.homeVideos.findIndex((video) => video.id === id);
  if (at < 0 || library.homeVideos[at]?.place === place) return library;
  const homeVideos = [...library.homeVideos];
  homeVideos[at] = { id, place };
  return { ...library, homeVideos };
}

/**
 * The video a dropped link names: the first address of a `text/uri-list`, else the plain text. A
 * bare id is not taken here, unlike in the search field: dragged words of eleven letters are no link.
 */
export function droppedVideoId(uriList: string, plain: string): string | undefined {
  const address = uriList.split(/\r?\n/).find((line) => line.trim() && !line.startsWith("#"));
  const text = (address ?? plain).trim();
  return isVideoId(text) ? undefined : youTubeVideoId(text);
}

/**
 * The library with the place in `id` kept: whole seconds, rounded down to `POSITION_STEP` while it
 * plays so that watching saves once per step, and exact when it is paused. A place within
 * `FINISHED_WITHIN` seconds of the end, or at the start, is forgotten.
 */
export function placed(
  library: TvLibraryState,
  id: string,
  seconds: number,
  duration: number,
  playing: boolean,
): TvLibraryState {
  const whole = Math.min(LIMITS.position, Math.max(0, Math.floor(seconds)));
  const kept = playing ? whole - (whole % POSITION_STEP) : whole;
  const done = duration > 0 && seconds >= duration - FINISHED_WITHIN;
  const { [id]: previous, ...others } = library.positions;
  if (done || kept <= 0)
    return previous === undefined ? library : { ...library, positions: others };
  if (previous === kept) return library;
  if (!library.videos.some((video) => video.id === id)) return library;
  const positions = { ...others, [id]: kept };
  // At the limit the place kept longest ago (the first key) is let go.
  const keys = Object.keys(positions);
  if (keys.length > LIMITS.positions) delete positions[keys[0] as string];
  return { ...library, positions };
}

/** The library after `id` played to its end: its place forgotten and out of Up Next. */
export function finished(library: TvLibraryState, id: string): TvLibraryState {
  const { [id]: _place, ...positions } = library.positions;
  return { ...unqueue(library, id), positions };
}

/**
 * The video Next goes to from `id`: the first of Up Next, or, after going back with Previous, the
 * one opened after it, or the next episode of its series.
 */
export function nextVideoId(library: TvLibraryState, id: string): string | undefined {
  const queued = library.upNext.find((other) => other !== id);
  if (queued) return queued;
  const at = library.history.findIndex((entry) => entry.id === id);
  return (at > 0 ? library.history[at - 1]?.id : undefined) ?? nextEpisodeId(id);
}

/** The video Previous goes to from `id`: the one opened before it. */
export function previousVideoId(library: TvLibraryState, id: string): string | undefined {
  const at = library.history.findIndex((entry) => entry.id === id);
  return at >= 0 ? library.history[at + 1]?.id : undefined;
}

/** History without `id`, and its place with it. */
export function removeFromHistory(library: TvLibraryState, id: string): TvLibraryState {
  const { [id]: _place, ...positions } = library.positions;
  return { ...library, history: library.history.filter((entry) => entry.id !== id), positions };
}

/** The place in `id` forgotten: out of Continue Watching, and still in History. */
export function forgetPlace(library: TvLibraryState, id: string): TvLibraryState {
  const { [id]: _place, ...positions } = library.positions;
  return { ...library, positions };
}

/** History emptied, and the places it held with it. */
export function clearHistory(library: TvLibraryState): TvLibraryState {
  return { ...library, history: [], positions: {} };
}

/** Started videos, most recently opened first: Continue Watching. */
export function continueWatching(library: TvLibraryState): TvVideo[] {
  return library.history.flatMap((entry) =>
    library.positions[entry.id] ? (findVideo(library, entry.id) ?? []) : [],
  );
}

/** The videos the person added by a link or a search, newest first: not the built-in ones. */
export function addedByPerson(library: TvLibraryState): TvVideo[] {
  const builtIn = new Set(BUILT_IN.map((video) => video.id));
  return [...library.videos].reverse().filter((video) => !builtIn.has(video.id));
}

/** Every video the window knows whose title or channel contains the words. */
export function searchLibrary(library: TvLibraryState, query: string): TvVideo[] {
  const needle = query.trim().toLowerCase();
  if (!needle) return [];
  const all = [...library.videos, ...BUILT_IN.filter((video) => !findIn(library.videos, video.id))];
  return all.filter(
    (video) =>
      video.title.toLowerCase().includes(needle) || video.channel.toLowerCase().includes(needle),
  );
}

const findIn = (videos: readonly TvVideo[], id: string) => videos.some((video) => video.id === id);

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);
const isVideo = (value: unknown): value is TvVideo =>
  isRecord(value) &&
  typeof value.id === "string" &&
  isVideoId(value.id) &&
  typeof value.title === "string" &&
  typeof value.channel === "string";
const isIds = (value: unknown): value is string[] =>
  Array.isArray(value) && value.every((id) => typeof id === "string" && isVideoId(id));
const isPlaylist = (value: unknown): value is TvPlaylist =>
  isRecord(value) &&
  typeof value.id === "string" &&
  typeof value.name === "string" &&
  isIds(value.videos);
const isHomeVideo = (value: unknown): value is TvHomeVideo =>
  isRecord(value) &&
  typeof value.id === "string" &&
  typeof value.place === "number" &&
  Number.isInteger(value.place) &&
  value.place >= 0;

const isLibrary = (value: unknown): value is TvLibraryState =>
  isRecord(value) &&
  Array.isArray(value.videos) &&
  value.videos.every(isVideo) &&
  Array.isArray(value.history) &&
  value.history.every(
    (entry) =>
      isRecord(entry) &&
      typeof entry.id === "string" &&
      typeof entry.at === "number" &&
      Number.isFinite(entry.at),
  ) &&
  isIds(value.upNext) &&
  isIds(value.watchLater) &&
  (value.playlists === undefined ||
    (Array.isArray(value.playlists) && value.playlists.every(isPlaylist))) &&
  (value.homeVideos === undefined ||
    (Array.isArray(value.homeVideos) && value.homeVideos.every(isHomeVideo))) &&
  (value.genres === undefined ||
    (isRecord(value.genres) &&
      Object.values(value.genres).every((genre) => typeof genre === "string"))) &&
  isRecord(value.positions) &&
  Object.values(value.positions).every(
    (seconds) => typeof seconds === "number" && Number.isInteger(seconds) && seconds >= 0,
  );

/** Whether a `GET` reply is one TV can read: a library, or `null` before the first save. */
export function tvLibraryReadable(reply: unknown): boolean {
  const library = isRecord(reply) ? reply.library : undefined;
  return library === null || isLibrary(library);
}

/** The library of a `GET` reply; the empty library when the person has none yet. */
export function tvLibraryFromServer(reply: unknown): TvLibraryState | undefined {
  if (!tvLibraryReadable(reply)) return undefined;
  const library = (reply as { library: TvLibraryState | null }).library;
  // A library saved while it had no playlists, home videos or genres has no such fields.
  return library
    ? {
        ...library,
        playlists: library.playlists ?? [],
        homeVideos: library.homeVideos ?? [],
        genres: library.genres ?? {},
      }
    : emptyLibrary;
}

/** The `PUT` body: only the fields the module keeps. */
export function tvLibraryToServer(library: TvLibraryState) {
  return {
    library: {
      videos: library.videos.map(({ id, title, channel }) => ({ id, title, channel })),
      history: library.history.map(({ id, at }) => ({ id, at: Math.max(0, Math.floor(at)) })),
      upNext: [...library.upNext],
      watchLater: [...library.watchLater],
      ...(library.playlists.length > 0
        ? {
            playlists: library.playlists.map(({ id, name, videos }) => ({
              id,
              name,
              videos: [...videos],
            })),
          }
        : {}),
      ...(library.homeVideos.length > 0
        ? { homeVideos: library.homeVideos.map(({ id, place }) => ({ id, place })) }
        : {}),
      ...(Object.keys(library.genres).length > 0 ? { genres: { ...library.genres } } : {}),
      positions: { ...library.positions },
    },
  };
}

/** A time as `m:ss`, or `h:mm:ss` from an hour. */
export function clockTime(seconds: number): string {
  const whole = Math.max(0, Math.floor(Number.isFinite(seconds) ? seconds : 0));
  const s = String(whole % 60).padStart(2, "0");
  const minutes = Math.floor(whole / 60);
  if (minutes < 60) return `${minutes}:${s}`;
  return `${Math.floor(minutes / 60)}:${String(minutes % 60).padStart(2, "0")}:${s}`;
}
