import { describe, expect, it } from "vitest";
import { licenseName } from "./music-archive";
import {
  albumsOf,
  archiveDownloadUrl,
  archiveFile,
  archiveSongId,
  artworkUrl,
  fitsKeepalive,
  keepLeftPlayback,
  type LibrarySong,
  leftPlaybackToSend,
  libraryFromServer,
  libraryReadable,
  librarySize,
  libraryToServer,
  lyricsFromServer,
  MUSIC_LIMITS,
  playbackFromServer,
  playbackReadable,
  playbackToServer,
  songFromArchive,
  takeLeftPlayback,
  UNKNOWN_ALBUM,
} from "./music-server";

describe("what Song Info keeps", () => {
  const song: LibrarySong = {
    id: "s",
    title: "T",
    artist: "A",
    album: "B",
    genre: "",
    year: null,
    track: null,
    duration: 10,
    added: 1,
    artwork: null,
    source: { kind: "file", file: "f", name: "n.mp3", type: "audio/mpeg", size: 1 },
  };
  it("sends a song's fields only when they say something, and reads them back", () => {
    const full = {
      ...song,
      grouping: "G",
      sortName: "N",
      start: 5,
      stop: 6,
      volumeAdjust: -20,
      eqPreset: "Rock",
      skipShuffle: true,
      unchecked: true,
    };
    const body = libraryToServer({ songs: [full], playlists: [], loved: [] });
    expect(libraryFromServer(body)?.songs[0]).toMatchObject({
      grouping: "G",
      sortName: "N",
      start: 5,
      stop: 6,
      volumeAdjust: -20,
      eqPreset: "Rock",
      skipShuffle: true,
      unchecked: true,
    });
    const plain = libraryToServer({
      songs: [{ ...song, grouping: "", start: null, skipShuffle: false }],
      playlists: [],
      loved: [],
    }).library.songs[0];
    expect(plain).not.toHaveProperty("grouping");
    expect(plain).not.toHaveProperty("start");
    expect(plain).not.toHaveProperty("skipShuffle");
  });
  it("reads lyrics, none before the first save, and refuses what is not lyrics", () => {
    expect(lyricsFromServer({ lyrics: null })).toEqual({});
    expect(lyricsFromServer({ lyrics: { a: "line" } })).toEqual({ a: "line" });
    expect(lyricsFromServer({ lyrics: { a: 1 } })).toBeUndefined();
  });
  it("keeps what Shuffle holds together in the playback, songs being the default", () => {
    const stored = playbackFromServer({ playback: null });
    if (!stored) throw new Error("no default playback");
    expect(playbackToServer({ ...stored, shuffleBy: "albums" }).playback).toHaveProperty(
      "shuffleBy",
      "albums",
    );
    expect(playbackToServer({ ...stored, shuffleBy: "songs" }).playback).not.toHaveProperty(
      "shuffleBy",
    );
  });
});

describe("a save made as the page went", () => {
  const stored = { ...playbackFromServer({ playback: null }), volume: 80, epoch: "e" };
  const reply = { playback: stored };
  const left = (volume: number, epoch = "e") =>
    JSON.stringify(playbackToServer({ ...stored, volume, epoch } as never));

  it("goes again when the page's own older save landed first and moved the revision by one", () => {
    const again = leftPlaybackToSend({ text: left(20), rev: 5, at: 1_000 }, reply, 6, 2_000);
    expect(again?.playback.volume).toBe(20);
  });

  it("does not go again when it landed, when the playback is another's, or when it is old", () => {
    expect(leftPlaybackToSend({ text: left(80), rev: 5, at: 1_000 }, reply, 6, 2_000)).toBeNull();
    expect(leftPlaybackToSend({ text: left(20), rev: 5, at: 1_000 }, reply, 7, 2_000)).toBeNull();
    expect(leftPlaybackToSend({ text: left(20), rev: 5, at: 1_000 }, reply, 5, 2_000)).toBeNull();
    expect(
      leftPlaybackToSend({ text: left(20, "other"), rev: 5, at: 1_000 }, reply, 6, 2_000),
    ).toBeNull();
    expect(leftPlaybackToSend({ text: left(20), rev: 5, at: 1_000 }, reply, 6, 100_000)).toBeNull();
    expect(leftPlaybackToSend(null, reply, 6, 2_000)).toBeNull();
    expect(
      leftPlaybackToSend(
        { text: '{"playback":{"volume":"x"}}', rev: 5, at: 1_000 },
        reply,
        6,
        2_000,
      ),
    ).toBeNull();
  });

  it("is kept in the tab until one page has read it", () => {
    keepLeftPlayback({ text: "t", rev: 3, at: 9 });
    expect(takeLeftPlayback()).toEqual({ text: "t", rev: 3, at: 9 });
    expect(takeLeftPlayback()).toBeNull();
  });
});

const song = (id: string, more: Partial<LibrarySong> = {}): LibrarySong => ({
  id,
  title: `T${id}`,
  artist: "Ada Rowan",
  album: "Slow Tide",
  genre: "",
  year: null,
  track: null,
  duration: 60,
  added: 0,
  artwork: null,
  source: { kind: "file", file: `f${id}`, name: `${id}.mp3`, type: "audio/mpeg", size: 1 },
  ...more,
});

/** An Internet Archive song's source, for songs played outside the library. */
const archiveSource = (): Partial<LibrarySong> => ({
  source: {
    kind: "archive",
    item: "DWK255",
    files: { mp3: "track.mp3" },
    license: "http://creativecommons.org/licenses/by/4.0/",
  },
});

describe("a save as the page goes", () => {
  it("counts bytes, as browsers do, so accented titles under the limit in letters are not sent", () => {
    expect(fitsKeepalive("a".repeat(40_000))).toBe(true);
    expect(fitsKeepalive("é".repeat(40_000))).toBe(false);
  });
});

describe("Music's documents on the Ferrite desktop", () => {
  it("keeps a song's composer on the server, and leaves out an empty one", () => {
    const body = libraryToServer({
      songs: [song("a", { composer: "Ada Row" }), song("b", { composer: "" })],
      playlists: [],
      loved: [],
    });
    expect(body.library.songs[0]).toMatchObject({ composer: "Ada Row" });
    expect(body.library.songs[1]).not.toHaveProperty("composer");
  });
  it("reads only libraries and playbacks in the module's shape", () => {
    expect(libraryReadable({ library: null, rev: 0 })).toBe(true);
    expect(libraryFromServer({ library: null })).toEqual({ songs: [], playlists: [], loved: [] });
    const stored = {
      songs: [{ ...song("a"), genre: undefined, year: undefined }],
      playlists: [],
      loved: ["a"],
    };
    expect(libraryReadable({ library: stored })).toBe(true);
    expect(libraryFromServer({ library: stored })?.songs[0]).toMatchObject({
      genre: "",
      year: null,
    });
    expect(libraryReadable({ library: { ...stored, loved: [1] } })).toBe(false);
    expect(
      libraryReadable({
        library: { ...stored, songs: [{ ...song("a"), source: { kind: "tape" } }] },
      }),
    ).toBe(false);
    expect(playbackReadable({ playback: null })).toBe(true);
    expect(playbackFromServer({ playback: null })?.volume).toBe(100);
    expect(
      playbackReadable({
        playback: { ...playbackFromServer({ playback: null }), repeat: "twice" },
      }),
    ).toBe(false);
  });

  it("sends only the fields the module keeps, within its limits", () => {
    const body = libraryToServer({
      songs: [song("a")],
      playlists: [{ id: "p", name: "Mix", songs: ["a"] }],
      loved: [],
    });
    expect(Object.keys(body.library.songs[0] ?? {})).toEqual([
      "id",
      "title",
      "artist",
      "album",
      "genre",
      "year",
      "track",
      "duration",
      "added",
      "artwork",
      "source",
    ]);
    const playback = playbackToServer({
      guests: [],
      queue: ["a", "b"],
      unshuffled: ["b", "a"],
      index: 5,
      position: 12.345,
      shuffle: false,
      repeat: "one",
      volume: 140,
      recent: ["a", "a", "b"],
      plays: { a: 2, b: 0 },
    }).playback;
    expect(playback).toMatchObject({
      unshuffled: [],
      index: 2,
      position: 12.3,
      volume: 100,
      recent: ["a", "b"],
      plays: { a: 2 },
    });
    expect(librarySize({ songs: [song("a")], playlists: [], loved: [] })).toBeGreaterThan(100);
  });

  it("keeps a playback save under the gateway's limit, with the song loaded and its guests", () => {
    // 1,000 long Internet Archive ids, shuffled, and 200 guests with long file names: far over
    // 256 KiB if sent whole.
    const ids = Array.from(
      { length: 1000 },
      (_, i) => `ia-${"x".repeat(100)}-${String(i).padStart(8, "0")}`,
    );
    const guests = ids.slice(0, 200).map((id) =>
      song(id, {
        title: "t".repeat(200),
        source: {
          kind: "archive",
          item: "x".repeat(100),
          files: { mp3: `${"m".repeat(290)}.mp3`, ogg: `${"o".repeat(290)}.ogg` },
          license: "http://creativecommons.org/licenses/by/4.0/",
        },
      }),
    );
    const body = playbackToServer({
      guests: [...guests, song("unnamed")],
      queue: ids,
      unshuffled: [...ids].reverse(),
      index: 150,
      position: 1,
      shuffle: true,
      repeat: "off",
      volume: 50,
      recent: [ids[150] as string],
      plays: {},
    });
    const size = new TextEncoder().encode(
      JSON.stringify({ ...body, rev: Number.MAX_SAFE_INTEGER, session: "0".repeat(128) }),
    ).length;
    expect(size).toBeLessThanOrEqual(MUSIC_LIMITS.playbackBytes);
    const { playback } = body;
    expect(playback.queue[playback.index]).toBe(ids[150]);
    expect(playback.queue.length).toBeGreaterThan(10);
    const kept = new Set(playback.guests.map((guest) => guest.id));
    expect(kept.has(ids[150] as string)).toBe(true);
    expect(kept.has("unnamed")).toBe(false);
    const named = new Set([...playback.queue, ...playback.unshuffled, ...playback.recent]);
    expect([...kept].every((id) => named.has(id))).toBe(true);
    expect(playback.unshuffled.every((id) => playback.queue.includes(id))).toBe(true);
    expect([...playback.unshuffled].sort()).toEqual([...playback.queue].sort());
  });

  it("cuts a shuffled queue of one song repeated, keeping both orders the same entries", () => {
    // One long id queued 1,000 times with 200 large guests: far over the limit, so the queue
    // is cut, and the order chosen must not keep 1,000 entries beside a shorter queue.
    const id = `ia-${"r".repeat(100)}-00000000`;
    const big = (n: number) =>
      song(`ia-${"g".repeat(100)}-${String(n).padStart(8, "0")}`, {
        title: "t".repeat(200),
        source: {
          kind: "archive",
          item: "x".repeat(100),
          files: { mp3: `${"m".repeat(290)}.mp3`, ogg: `${"o".repeat(290)}.ogg` },
          license: "http://creativecommons.org/licenses/by/4.0/",
        },
      });
    const guests = Array.from({ length: 200 }, (_, n) => big(n));
    const queue = [...Array.from({ length: 500 }, () => id), ...guests.map((g) => g.id)];
    const { playback } = playbackToServer({
      guests,
      queue,
      unshuffled: [...queue].reverse(),
      index: 0,
      position: 0,
      shuffle: true,
      repeat: "off",
      volume: 50,
      recent: [],
      plays: {},
    });
    expect(playback.queue.length).toBeLessThan(queue.length);
    expect(playback.unshuffled).toHaveLength(playback.queue.length);
    expect([...playback.unshuffled].sort()).toEqual([...playback.queue].sort());
  });

  it("saves no queue entry or history line whose song outside the library it cannot keep", () => {
    // 300 Internet Archive songs outside the library, all queued: only 200 can be kept.
    const guests = Array.from({ length: 300 }, (_, n) => song(`g${n}`, archiveSource()));
    const { playback } = playbackToServer({
      guests,
      queue: guests.map((g) => g.id),
      unshuffled: [],
      index: 50,
      position: 0,
      shuffle: false,
      repeat: "off",
      volume: 50,
      recent: ["g299", "g10", "lib-song"],
      plays: {},
    });
    const kept = new Set(playback.guests.map((g) => g.id));
    expect(kept.size).toBe(200);
    expect(playback.queue[playback.index]).toBe("g50");
    // What plays next is kept first: g50 to g249, and nothing else.
    expect(playback.queue).toEqual(Array.from({ length: 200 }, (_, n) => `g${n + 50}`));
    expect(playback.queue.every((id) => kept.has(id))).toBe(true);
    // A library song stays in the history; guests not kept leave it.
    expect(playback.recent).toEqual(["lib-song"]);
  });

  it("keeps the queued songs outside the library after the last song has ended", () => {
    const guests = ["g1", "g2", "g3"].map((id) => song(id, archiveSource()));
    const { playback } = playbackToServer({
      guests,
      queue: ["g1", "lib", "g2", "g3"],
      unshuffled: [],
      // Past the end: nothing loaded.
      index: 4,
      position: 0,
      shuffle: false,
      repeat: "off",
      volume: 50,
      recent: [],
      plays: {},
    });
    expect(playback.queue).toEqual(["g1", "lib", "g2", "g3"]);
    expect(playback.index).toBe(4);
    expect(playback.guests.map((g) => g.id).sort()).toEqual(["g1", "g2", "g3"]);
  });

  it("keeps each entry's place in the order chosen when a shuffled queue is cut", () => {
    const id = (n: number) => `ia-${"q".repeat(100)}-${String(n % 7).padStart(8, "0")}`;
    // 1,000 entries naming 7 songs, shuffled: unshuffled is 0..999 by song, played reversed.
    const unshuffled = Array.from({ length: 1000 }, (_, n) => id(n));
    const order = Array.from({ length: 1000 }, (_, n) => 999 - n);
    const queue = order.map((place) => unshuffled[place] as string);
    const plays = Object.fromEntries(
      Array.from({ length: 500 }, (_, n) => [
        `ia-${"p".repeat(100)}-${String(n).padStart(8, "0")}`,
        1,
      ]),
    );
    const { playback } = playbackToServer({
      guests: [],
      queue: [...queue, ...queue],
      unshuffled: [...unshuffled, ...unshuffled],
      order: [...order, ...order.map((place) => place + 1000)],
      index: 400,
      position: 0,
      shuffle: true,
      repeat: "off",
      volume: 50,
      recent: [],
      plays,
    });
    expect(playback.queue.length).toBeLessThan(1000);
    expect(playback.order).toHaveLength(playback.queue.length);
    expect(new Set(playback.order).size).toBe(playback.order.length);
    playback.order.forEach((place, i) => {
      expect(playback.unshuffled[place]).toBe(playback.queue[i]);
    });
  });

  it("keeps the most played counts, and a song just played, when there are more than it keeps", () => {
    const id = (n: number) => `s${String(n).padStart(3, "0")}`;
    // 500 songs played once in the past, then one played three times and one played just now.
    const plays: Record<string, number> = Object.fromEntries(
      Array.from({ length: 500 }, (_, n) => [id(n), 1]),
    );
    plays.favourite = 3;
    plays.newest = 1;
    const body = playbackToServer({
      guests: [],
      queue: ["newest"],
      unshuffled: [],
      index: 0,
      position: 0,
      shuffle: false,
      repeat: "off",
      volume: 50,
      recent: ["newest"],
      plays,
    });
    const kept = body.playback.plays;
    expect(Object.keys(kept)).toHaveLength(500);
    expect(kept.favourite).toBe(3);
    expect(kept.newest).toBe(1);
    // The two that go are the oldest of those played once.
    expect(kept[id(0)]).toBeUndefined();
    expect(kept[id(1)]).toBeUndefined();
    expect(kept[id(2)]).toBe(1);
  });

  it("dates an album in days before today, so Recently Added's ascending order is newest first", () => {
    const day = 86_400_000;
    const albums = albumsOf(
      {
        songs: [
          song("old", { album: "Older", added: 1 * day }),
          song("new", { album: "Newer", added: 5 * day }),
        ],
        playlists: [],
        loved: [],
      },
      6 * day,
    );
    // The window's Recently Added sorts by `added` ascending (music-desktop.tsx).
    const recentlyAdded = [...albums].sort((a, b) => a.added - b.added);
    expect(recentlyAdded.map((album) => [album.title, album.added])).toEqual([
      ["Newer", 1],
      ["Older", 5],
    ]);
  });

  it("groups songs into albums in track order, by album and artist", () => {
    const albums = albumsOf(
      {
        songs: [
          song("2", { track: 2, added: 3 * 86_400_000 }),
          song("1", { track: 1, artwork: "a".repeat(64) }),
          song("x", { album: "", artist: "" }),
          song("y", { artist: "Someone Else" }),
        ],
        playlists: [],
        loved: [],
      },
      5 * 86_400_000,
    );
    expect(albums.map((album) => [album.title, album.artist])).toEqual([
      ["Slow Tide", "Ada Rowan"],
      ["Slow Tide", "Someone Else"],
      [UNKNOWN_ALBUM, "Unknown Artist"],
    ]);
    expect(albums[0]?.songs.map((s) => s.id)).toEqual(["1", "2"]);
    expect(albums[0]?.added).toBe(2);
    expect(albums[0]?.artwork).toBe(`/api/music/artwork/${"a".repeat(64)}`);
  });

  it("plays an Internet Archive song from archive.org, choosing a format the browser plays", () => {
    const source = {
      kind: "archive" as const,
      item: "DWK255",
      files: { mp3: "Disc 1/01 #1.mp3", ogg: "01.ogg" },
      license: "http://creativecommons.org/licenses/by-nc-nd/4.0/",
    };
    expect(archiveFile(source, (t) => (t === "audio/mpeg" ? "maybe" : ""))).toBe(
      "Disc 1/01 #1.mp3",
    );
    expect(archiveFile(source, (t) => (t.startsWith("audio/ogg") ? "probably" : ""))).toBe(
      "01.ogg",
    );
    expect(archiveFile(source, () => "")).toBeUndefined();
    expect(archiveDownloadUrl("DWK255", "Disc 1/01 #1.mp3")).toBe(
      "https://archive.org/download/DWK255/Disc%201/01%20%231.mp3",
    );
    expect(artworkUrl(song("z", { source }))).toBe("https://archive.org/services/img/DWK255");
  });

  it("makes one stable plain id per Internet Archive track", () => {
    const id = archiveSongId("DWK255", "Subjectjazz_-_01_-_NSIME");
    expect(id).toMatch(/^ia-DWK255-[0-9a-f]{8}$/);
    expect(archiveSongId("DWK255", "Subjectjazz_-_01_-_NSIME")).toBe(id);
    expect(archiveSongId("DWK255", "Subjectjazz_-_02_-_Connexion")).not.toBe(id);
    expect(archiveSongId("x".repeat(100), "t").length).toBeLessThanOrEqual(128);
    const item = {
      identifier: "DWK255",
      title: "Saturne (EP)",
      creator: "Subjectjazz",
      year: 2014,
      license: "https://creativecommons.org/licenses/by/4.0/",
      tracks: [],
    };
    const made = songFromArchive(
      item,
      {
        id: "t1",
        title: "NSIME",
        artist: null,
        album: "",
        track: 1,
        duration: null,
        files: { mp3: "a.mp3" },
      },
      9,
    );
    expect(made).toMatchObject({
      artist: "Subjectjazz",
      album: "Saturne (EP)",
      duration: 0,
      added: 9,
      year: 2014,
    });
    expect(licenseName("http://creativecommons.org/licenses/by-nc-nd/4.0/")).toBe(
      "CC BY-NC-ND 4.0",
    );
    expect(licenseName("https://creativecommons.org/publicdomain/zero/1.0/")).toBe("CC0 1.0");
    expect(licenseName("https://creativecommons.org/publicdomain/mark/1.0/")).toBe(
      "Public Domain Mark 1.0",
    );
  });
});
