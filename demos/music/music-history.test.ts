import { describe, expect, it } from "vitest";
import { applyLibraryChange, withInPlaylist, withLoved } from "./music-history";
import type { LibrarySong, MusicLibraryState } from "./music-server";

const song = (id: string): LibrarySong => ({
  id,
  title: id,
  artist: "",
  album: "",
  genre: "",
  year: null,
  track: null,
  duration: 1,
  added: 0,
  artwork: null,
  source: { kind: "file", file: id, name: id, type: "audio/wav", size: 1 },
});
const a = song("a");
const b = song("b");
const c = song("c");
const library = (more: Partial<MusicLibraryState> = {}): MusicLibraryState => ({
  songs: [a, b],
  playlists: [],
  loved: [],
  ...more,
});

describe("Adding songs to a list", () => {
  it("leaves out an id the library no longer holds, which the server would refuse", () => {
    const now = library({ playlists: [{ id: "p", name: "P", songs: ["a"] }], loved: ["a"] });
    expect(withLoved(now, ["a", "b", "gone"]).loved).toEqual(["a", "b"]);
    expect(withInPlaylist(now, ["a", "b", "gone"], "p").playlists[0]?.songs).toEqual(["a", "b"]);
  });
});

describe("Music's Undo", () => {
  it("takes back a love and keeps a song imported since", () => {
    const before = library();
    const after = library({ loved: ["a"] });
    const now = library({ songs: [a, b, c], loved: ["a"] });
    expect(applyLibraryChange(now, after, before)).toEqual(
      library({ songs: [a, b, c], loved: [] }),
    );
  });

  it("brings a deleted song back to its playlist, and Redo takes it out again", () => {
    const list = { id: "p", name: "P", songs: ["a", "b"] };
    const before = library({ playlists: [list], loved: ["a"] });
    const after: MusicLibraryState = {
      songs: [b],
      playlists: [{ ...list, songs: ["b"] }],
      loved: [],
    };
    const undone = applyLibraryChange(after, after, before);
    expect(undone.songs.map((s) => s.id).sort()).toEqual(["a", "b"]);
    expect(undone.playlists[0]?.songs).toEqual(["a", "b"]);
    expect(undone.loved).toEqual(["a"]);
    expect(applyLibraryChange(undone, before, after)).toEqual(after);
  });

  it("keeps a song another window added to the playlist, through Undo and Redo", () => {
    const list = { id: "p", name: "P", songs: [] as string[] };
    const before = library({ playlists: [list] });
    const after = library({ playlists: [{ ...list, songs: ["a"] }] });
    const now = library({ playlists: [{ ...list, songs: ["a", "b"] }] });
    const undone = applyLibraryChange(now, after, before);
    expect(undone.playlists[0]?.songs).toEqual(["b"]);
    expect(applyLibraryChange(undone, before, after).playlists[0]?.songs).toEqual(["b", "a"]);
  });

  it("keeps a playlist another window changed when its making is taken back, and makes it again", () => {
    const before = library();
    const after = library({ playlists: [{ id: "p", name: "P", songs: ["a"] }] });
    const now = library({ playlists: [{ id: "p", name: "P", songs: ["a", "b"] }] });
    const undone = applyLibraryChange(now, after, before);
    expect(undone.playlists).toEqual([{ id: "p", name: "P", songs: ["b"] }]);
    expect(applyLibraryChange(undone, before, after).playlists[0]?.songs).toEqual(["b", "a"]);
    expect(applyLibraryChange(after, after, before).playlists).toEqual([]);
  });

  it("keeps a song the change added while a playlist named since holds it", () => {
    const before = library();
    const after = library({ songs: [a, b, c], loved: ["c"] });
    const now = library({
      songs: [a, b, c],
      loved: ["c"],
      playlists: [{ id: "p", name: "P", songs: ["c"] }],
    });
    const undone = applyLibraryChange(now, after, before);
    expect(undone.songs.map((s) => s.id)).toEqual(["a", "b", "c"]);
    expect(undone.loved).toEqual([]);
    expect(applyLibraryChange(after, after, before).songs.map((s) => s.id)).toEqual(["a", "b"]);
  });

  it("leaves alone the order another window gave a playlist the change did not touch", () => {
    const list = { id: "p", name: "P", songs: ["a", "b"] };
    const before = library({ playlists: [list] });
    const after = library({ playlists: [list], loved: ["a"] });
    const now = library({ playlists: [{ ...list, songs: ["b", "a"] }], loved: ["a"] });
    const undone = applyLibraryChange(now, after, before);
    expect(undone.playlists[0]?.songs).toEqual(["b", "a"]);
    expect(applyLibraryChange(undone, before, after).playlists[0]?.songs).toEqual(["b", "a"]);
  });

  it("keeps another window's order when the change only added a song", () => {
    const list = { id: "p", name: "P", songs: ["a", "b"] };
    const before = library({ songs: [a, b, c], playlists: [list] });
    const after = library({ songs: [a, b, c], playlists: [{ ...list, songs: ["a", "b", "c"] }] });
    const now = library({ songs: [a, b, c], playlists: [{ ...list, songs: ["b", "a", "c"] }] });
    const undone = applyLibraryChange(now, after, before);
    expect(undone.playlists[0]?.songs).toEqual(["b", "a"]);
    const redone = applyLibraryChange(undone, before, after).playlists[0]?.songs ?? [];
    expect(redone.indexOf("b")).toBeLessThan(redone.indexOf("a"));
    expect(redone).toContain("c");
  });

  it("leaves out of a playlist a song the library no longer has", () => {
    const before = library();
    const after = library({ playlists: [{ id: "p", name: "P", songs: ["a", "b"] }] });
    const now = library({ songs: [a] });
    expect(applyLibraryChange(now, before, after).playlists[0]?.songs).toEqual(["a"]);
  });
});
