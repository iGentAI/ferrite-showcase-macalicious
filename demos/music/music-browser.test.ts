import { describe, expect, it } from "vitest";
import { albumsAfter, BROWSE_ALL, browseSongs, NO_ALBUMS } from "./music-browser";
import type { LibrarySong } from "./music-server";

const song = (id: string, genre: string, artist: string, album: string) =>
  ({ id, genre, artist, album }) as LibrarySong;
const songs = [
  song("a", "Folk", "Pine", "Woods"),
  song("b", "Folk", "Elm", "Hills"),
  song("c", "Jazz", "Pine", "Night"),
];
const ids = (list: readonly LibrarySong[]) => list.map((each) => each.id);

describe("albums chosen together", () => {
  const order = ["a", "b", "c", "d"];
  it("Command adds an album and takes a chosen one away", () => {
    const two = albumsAfter(albumsAfter(NO_ALBUMS, order, "a", false), order, "c", false);
    expect(two).toEqual({ ids: ["a", "c"], anchor: "c" });
    expect(albumsAfter(two, order, "a", false).ids).toEqual(["c"]);
  });

  it("Shift reaches from the anchor, either way", () => {
    const one = albumsAfter(NO_ALBUMS, order, "c", false);
    expect(albumsAfter(one, order, "a", true)).toEqual({ ids: ["a", "b", "c"], anchor: "c" });
    expect(albumsAfter(one, order, "d", true).ids).toEqual(["c", "d"]);
  });

  it("Shift with nothing to reach from chooses the album", () => {
    expect(albumsAfter(NO_ALBUMS, order, "b", true)).toEqual({ ids: ["b"], anchor: "b" });
  });
});

describe("the Column Browser", () => {
  it("lists everything with nothing chosen", () => {
    const shown = browseSongs(songs, BROWSE_ALL);
    expect(shown.genres).toEqual(["Folk", "Jazz"]);
    expect(shown.artists).toEqual(["Elm", "Pine"]);
    expect(shown.albums).toEqual(["Hills", "Night", "Woods"]);
    expect(ids(shown.songs)).toEqual(["a", "b", "c"]);
  });

  it("narrows each column by the ones before it", () => {
    const shown = browseSongs(songs, { genre: "Folk", artist: "Pine", album: null });
    expect(shown.artists).toEqual(["Elm", "Pine"]);
    expect(shown.albums).toEqual(["Woods"]);
    expect(ids(shown.songs)).toEqual(["a"]);
  });

  it("counts a choice its column no longer lists as All", () => {
    const shown = browseSongs(songs, { genre: "Jazz", artist: "Elm", album: "Hills" });
    expect(shown.choice).toEqual({ genre: "Jazz", artist: null, album: null });
    expect(ids(shown.songs)).toEqual(["c"]);
  });
});
