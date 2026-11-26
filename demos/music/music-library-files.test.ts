import { describe, expect, it } from "vitest";
import {
  duplicateSongs,
  fileNameOf,
  isPlaylistFile,
  matchEntries,
  playlistNameOf,
  playlistsHolding,
  readM3u,
  songListPage,
  writeLibraryXml,
  writeM3u,
} from "./music-library-files";
import type { LibraryPlaylist, LibrarySong } from "./music-server";

const song = (id: string, title: string, artist: string, duration = 125): LibrarySong => ({
  id,
  title,
  artist,
  album: "An <Album>",
  genre: "Folk",
  year: 1999,
  track: 2,
  duration,
  added: 1,
  artwork: null,
  source: { kind: "file", file: `f-${id}`, name: `${title}.mp3`, type: "audio/mpeg", size: 1 },
});

describe("playlist files", () => {
  it("writes an extended M3U, which reads back as the same songs", () => {
    const songs = [song("a", "Fir", "Pine - Oak"), song("b", "Ash", "Elm", 61.6)];
    const text = writeM3u(songs);
    expect(text).toBe(
      "#EXTM3U\n#EXTINF:125,Pine - Oak - Fir\n#MUSIC-SONG-ID:a\n./Fir.mp3\n#EXTINF:62,Elm - Ash\n#MUSIC-SONG-ID:b\n./Ash.mp3\n",
    );
    expect(readM3u(text)).toEqual([
      { name: "Pine - Oak - Fir", id: "a" },
      { name: "Elm - Ash", id: "b" },
    ]);
  });

  it("brings back the song exported, of two that read the same, in either order", () => {
    const one = song("a", "Fir - Live", "Pine");
    const two = song("b", "Live", "Pine - Fir");
    for (const library of [
      [one, two],
      [two, one],
    ]) {
      expect(matchEntries(readM3u(writeM3u([one])), library).ids).toEqual(["a"]);
      expect(matchEntries(readM3u(writeM3u([two])), library).ids).toEqual(["b"]);
    }
  });

  it("keeps a song whose file's name begins with # or holds a line break", () => {
    const hash = { ...song("a", "Fir", "Pine") };
    hash.source = { kind: "file", file: "f", name: "#Fir.wav", type: "audio/wav", size: 1 };
    const broken = { ...song("b", "Ash", "Elm") };
    broken.source = { kind: "file", file: "f", name: "A\nsh.wav", type: "audio/wav", size: 1 };
    expect(matchEntries(readM3u(writeM3u([hash, broken])), [hash, broken])).toEqual({
      ids: ["a", "b"],
      missing: 0,
    });
  });

  it("goes by the words when the file's song is no longer in the library", () => {
    const gone = song("gone", "Ash", "Elm");
    const again = song("new", "Ash", "Elm");
    expect(matchEntries(readM3u(writeM3u([gone])), [again]).ids).toEqual(["new"]);
  });

  it("brings back a song with a dash or doubled spaces in its title or artist", () => {
    const songs = [song("a", "Fir - Live", "Pine"), song("b", "Two  Spaces", "Oak - Elm")];
    expect(matchEntries(readM3u(writeM3u(songs)), songs)).toEqual({
      ids: ["a", "b"],
      missing: 0,
    });
  });

  it("reads a plain list by its files' names, with Windows line ends and a byte order mark", () => {
    expect(readM3u("\uFEFFmusic/One Song.mp3\r\n\r\nC:\\tunes\\Two.flac\r\n")).toEqual([
      { name: "One Song" },
      { name: "Two" },
    ]);
  });

  it("finds the library's songs in the file's order, ignoring case, and counts the rest", () => {
    const songs = [song("a", "Fir", "Pine"), song("b", "Ash", "Elm")];
    expect(
      matchEntries([{ name: "elm - ASH" }, { name: "Nobody - Fir" }, { name: "fir" }], songs),
    ).toEqual({ ids: ["b", "a"], missing: 1 });
  });

  it("names files safely and takes a playlist's name from a file's", () => {
    expect(fileNameOf("Road/Trip: 1", "m3u")).toBe("Road-Trip- 1.m3u");
    expect(fileNameOf("  ", "m3u")).toBe("Untitled.m3u");
    expect(playlistNameOf("Road Trip.m3u8")).toBe("Road Trip");
    expect(isPlaylistFile("a.M3U")).toBe(true);
    expect(isPlaylistFile("a.m3u8")).toBe(true);
    expect(isPlaylistFile("a.mp3")).toBe(false);
  });
});

describe("the library", () => {
  it("finds the same title and artist, side by side, and nothing alone", () => {
    const songs = [
      song("a", "Fir", "Pine"),
      song("b", "Ash", "Elm"),
      song("c", "fir ", "PINE"),
      song("d", "Fir", "Other"),
    ];
    expect(duplicateSongs(songs).map((each) => each.id)).toEqual(["a", "c"]);
    expect(duplicateSongs([songs[1] as LibrarySong])).toEqual([]);
  });

  it("lists the hand-made playlists holding a song", () => {
    const lists = [
      { id: "1", name: "Mine", songs: ["a"] },
      { id: "2", name: "Other", songs: ["b"] },
      { id: "3", name: "Smart", songs: ["a"], smart: {} },
    ] as unknown as LibraryPlaylist[];
    expect(playlistsHolding(lists, "a").map((list) => list.name)).toEqual(["Mine"]);
  });

  it("exports its songs and playlists, escaped, leaving out what is gone", () => {
    const xml = writeLibraryXml(
      [song("a", "Fir & Ash", "Pine")],
      [
        { name: "Mine", songs: ["a", "gone"], smart: false },
        { name: "Rules", songs: ["a"], smart: true },
      ],
    );
    expect(xml).toContain("<key>Name</key><string>Fir &amp; Ash</string>");
    expect(xml).toContain("<key>Album</key><string>An &lt;Album&gt;</string>");
    expect(xml).toContain("<key>Total Time</key><integer>125000</integer>");
    expect(xml).toContain(
      "<dict><key>Name</key><string>Mine</string><key>Playlist Items</key><array><dict><key>Track ID</key><integer>1</integer></dict></array></dict>",
    );
    expect(xml).toContain(
      "<dict><key>Name</key><string>Rules</string><key>Smart</key><true/><key>Playlist Items</key><array><dict><key>Track ID</key><integer>1</integer></dict></array></dict>",
    );
  });

  it("puts a list on paper, escaped", () => {
    const page = songListPage("<Mine>", [song("a", "Fir", "Pine", 119.6)]);
    expect(page).toContain("<h1>&lt;Mine&gt;</h1>");
    expect(page).toContain("<td>Fir</td><td>Pine</td><td>An &lt;Album&gt;</td><td>2:00</td>");
  });
});
