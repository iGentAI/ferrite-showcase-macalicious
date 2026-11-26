import type { PageSetup } from "../textedit/textedit-drive";
import type { LibraryPlaylist, LibrarySong } from "./music-server";

/*
 * Music's files: a playlist as an M3U list, the library as the XML property list File > Library >
 * Export Library writes, and a list of songs on paper. An M3U names its songs by artist and title
 * only, since the library's songs live on the person's drive or at the Internet Archive, so reading
 * one finds each song by those.
 */

/** One line of a playlist file: the words it names a song by, and the song itself in a file of ours. */
export interface PlaylistEntry {
  name: string;
  id?: string;
}

/** Music's own comment line, which other players pass over: artist and title can read the same. */
const ID_LINE = "#MUSIC-SONG-ID:";

const FILE_NAME_UNSAFE = /[/\\:*?"<>|]/g;

/** The file name for a playlist or library called `name`, with its extension. */
export const fileNameOf = (name: string, extension: string) =>
  `${name.replace(FILE_NAME_UNSAFE, "-").trim() || "Untitled"}.${extension}`;

/** The playlist's name a file gives: its name without its extension. */
export const playlistNameOf = (fileName: string) => fileName.replace(/\.[^.]*$/, "") || fileName;

export const isPlaylistFile = (fileName: string) => /\.m3u8?$/i.test(fileName);

/** How a song goes in an M3U: its artist and title, on one line. */
const lineOf = (song: Pick<LibrarySong, "artist" | "title">) =>
  `${song.artist} - ${song.title}`.replace(/\s+/g, " ").trim();

/** The songs as an extended M3U. */
export function writeM3u(songs: readonly LibrarySong[]): string {
  const lines = ["#EXTM3U"];
  for (const song of songs) {
    lines.push(`#EXTINF:${Math.round(song.duration)},${lineOf(song)}`);
    lines.push(`${ID_LINE}${song.id}`);
    // A location of its own folder: a name may begin with `#`, which would make the line a comment.
    const location =
      song.source.kind === "file"
        ? song.source.name
        : song.source.kind === "archive"
          ? song.source.item
          : song.source.url;
    lines.push(`./${location.replace(/\s+/g, " ")}`);
  }
  return `${lines.join("\n")}\n`;
}

/** The songs an M3U names. A song with no `#EXTINF` line goes by its file's name. */
export function readM3u(text: string): PlaylistEntry[] {
  const entries: PlaylistEntry[] = [];
  let named: PlaylistEntry | null = null;
  let id: string | undefined;
  for (const raw of text.replace(/^\uFEFF/, "").split(/\r?\n/)) {
    const line = raw.trim();
    if (line === "") continue;
    if (line.startsWith(ID_LINE)) {
      id = line.slice(ID_LINE.length).trim();
      continue;
    }
    if (line.startsWith("#")) {
      const info = /^#EXTINF:[^,]*,(.*)$/.exec(line);
      if (info) named = { name: (info[1] ?? "").trim() };
      continue;
    }
    const file = line.split(/[/\\]/).pop() ?? line;
    entries.push({ ...(named ?? { name: playlistNameOf(file) }), ...(id ? { id } : {}) });
    named = null;
    id = undefined;
  }
  return entries;
}

const sameText = (a: string, b: string) =>
  a.replace(/\s+/g, " ").trim().toLowerCase() === b.replace(/\s+/g, " ").trim().toLowerCase();

/**
 * The library's songs the entries name, in their order, and how many name no song of it. A file of
 * ours names each song exactly. Otherwise an entry names a song by its whole `Artist - Title` line,
 * since either may hold ` - ` itself, or by its title alone: another program's list may give no
 * artist. Two songs that read the same line go to the first.
 */
export function matchEntries(
  entries: readonly PlaylistEntry[],
  songs: readonly LibrarySong[],
): { ids: string[]; missing: number } {
  const ids: string[] = [];
  let missing = 0;
  for (const entry of entries) {
    const song =
      songs.find((each) => each.id === entry.id) ??
      songs.find((each) => sameText(lineOf(each), entry.name)) ??
      songs.find((each) => sameText(each.title, entry.name));
    if (song) ids.push(song.id);
    else missing += 1;
  }
  return { ids, missing };
}

/** The songs with the same title and artist as another of the library, the same ones side by side. */
export function duplicateSongs(songs: readonly LibrarySong[]): LibrarySong[] {
  const keyOf = (song: LibrarySong) =>
    `${song.title.trim().toLowerCase()}\n${song.artist.trim().toLowerCase()}`;
  const groups = new Map<string, LibrarySong[]>();
  for (const song of songs) groups.set(keyOf(song), [...(groups.get(keyOf(song)) ?? []), song]);
  return [...groups.values()].filter((group) => group.length > 1).flat();
}

/** The hand-made playlists that hold `song`. */
export const playlistsHolding = (playlists: readonly LibraryPlaylist[], song: string) =>
  playlists.filter((list) => !list.smart && list.songs.includes(song));

const escapeXml = (text: string) =>
  text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

/**
 * The library as the property list Music exports, with each song's and playlist's own fields. A
 * smart playlist is listed with the songs it holds now, and marked as smart.
 */
export function writeLibraryXml(
  songs: readonly LibrarySong[],
  playlists: readonly { name: string; songs: readonly string[]; smart: boolean }[],
): string {
  const text = (key: string, value: string) =>
    value === "" ? "" : `<key>${key}</key><string>${escapeXml(value)}</string>`;
  const integer = (key: string, value: number | null | undefined) =>
    value == null ? "" : `<key>${key}</key><integer>${Math.round(value)}</integer>`;
  const numbers = new Map(songs.map((song, index) => [song.id, index + 1]));
  const tracks = songs.map(
    (song, index) =>
      `<key>${index + 1}</key><dict>${integer("Track ID", index + 1)}${text("Name", song.title)}${text(
        "Artist",
        song.artist,
      )}${text("Album", song.album)}${text("Genre", song.genre)}${integer("Year", song.year)}${integer(
        "Track Number",
        song.track,
      )}${integer("Total Time", song.duration * 1000)}</dict>`,
  );
  const lists = playlists.map(
    (list) =>
      `<dict>${text("Name", list.name)}${list.smart ? "<key>Smart</key><true/>" : ""}<key>Playlist Items</key><array>${list.songs
        .flatMap((id) => {
          const number = numbers.get(id);
          return number ? [`<dict>${integer("Track ID", number)}</dict>`] : [];
        })
        .join("")}</array></dict>`,
  );
  return [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<!DOCTYPE plist PUBLIC "-//Apple Computer//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">',
    '<plist version="1.0"><dict>',
    `<key>Tracks</key><dict>${tracks.join("")}</dict>`,
    `<key>Playlists</key><array>${lists.join("")}</array>`,
    "</dict></plist>",
    "",
  ].join("\n");
}

const minutes = (seconds: number) => {
  const whole = Math.round(seconds);
  return `${Math.floor(whole / 60)}:${String(whole % 60).padStart(2, "0")}`;
};

/** The list on paper: a page of its own, with what the song table shows, on the paper chosen. */
export function songListPage(
  title: string,
  songs: readonly LibrarySong[],
  paper?: PageSetup,
): string {
  const rows = songs
    .map(
      (song) =>
        `<tr><td>${escapeXml(song.title)}</td><td>${escapeXml(song.artist)}</td><td>${escapeXml(
          song.album,
        )}</td><td>${minutes(song.duration)}</td></tr>`,
    )
    .join("");
  const setup = paper
    ? `@page{size:${paper.paper === "a4" ? "A4" : "Letter"} ${paper.orientation}}${
        paper.scale === 100 ? "" : `html{zoom:${paper.scale / 100}}`
      }`
    : "";
  return `<!doctype html><html><head><meta charset="utf-8"><title>${escapeXml(title)}</title><style>${setup}body{font:11pt sans-serif}table{width:100%;border-collapse:collapse}th,td{text-align:left;padding:2pt 6pt;border-bottom:0.5pt solid #bbb}</style></head><body><h1>${escapeXml(title)}</h1><table><thead><tr><th>Name</th><th>Artist</th><th>Album</th><th>Time</th></tr></thead><tbody>${rows}</tbody></table></body></html>`;
}

/**
 * Prints the page through the browser's print dialog, from a frame of its own. The frame goes when
 * printing has ended, or when the next list is printed.
 */
export function printPage(page: string, host: Document = document): void {
  for (const earlier of host.querySelectorAll("iframe[data-music-print]")) earlier.remove();
  const frame = host.createElement("iframe");
  frame.setAttribute("data-music-print", "");
  frame.setAttribute("sandbox", "allow-modals allow-same-origin");
  frame.setAttribute("aria-hidden", "true");
  frame.tabIndex = -1;
  frame.style.cssText = "position:fixed;right:0;bottom:0;width:0;height:0;border:0;opacity:0";
  frame.srcdoc = page;
  frame.addEventListener(
    "load",
    () => {
      const view = frame.contentWindow;
      view?.addEventListener("afterprint", () => frame.remove(), { once: true });
      view?.focus();
      view?.print();
    },
    { once: true },
  );
  host.body.append(frame);
}
