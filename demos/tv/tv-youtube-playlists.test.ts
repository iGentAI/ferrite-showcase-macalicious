import { describe, expect, it } from "vitest";
import {
  addPlaylist,
  addToPlaylist,
  cleanPlaylistName,
  deletePlaylist,
  emptyLibrary,
  know,
  LIMITS,
  libraryBytes,
  noNewPlaylist,
  noRoomInPlaylist,
  removeFromPlaylist,
  renamePlaylist,
  type TvLibraryState,
  tvLibraryFromServer,
  tvLibraryToServer,
} from "./tv-youtube-data";

const video = (id: string) => ({ id, title: `Title ${id}`, channel: "" });
const A = "aaaaaaaaaaa";
const B = "bbbbbbbbbbb";
const C = "ccccccccccc";
const holding = (...ids: string[]) => addPlaylist(emptyLibrary, "pl-1", "Evening", ids.map(video));
const order = (library: TvLibraryState) => library.playlists[0]?.videos;

describe("playlists", () => {
  it("a new playlist holds its videos, and the library knows them", () => {
    const library = holding(A, B);
    expect(library.playlists).toEqual([{ id: "pl-1", name: "Evening", videos: [A, B] }]);
    expect(library.videos.map((each) => each.id)).toEqual([A, B]);
  });

  it("a video joins once, and moves when dropped before another", () => {
    const library = addToPlaylist(holding(A, B), "pl-1", video(C), A);
    expect(order(library)).toEqual([C, A, B]);
    expect(order(addToPlaylist(library, "pl-1", video(B), C))).toEqual([B, C, A]);
    expect(order(addToPlaylist(library, "pl-1", video(A), A))).toEqual([C, A, B]);
    expect(order(addToPlaylist(library, "pl-1", video(C)))).toEqual([A, B, C]);
  });

  it("renames, removes from and deletes a playlist, leaving the videos known", () => {
    const library = holding(A, B);
    expect(renamePlaylist(library, "pl-1", " Night ").playlists[0]?.name).toBe("Night");
    expect(order(removeFromPlaylist(library, "pl-1", A))).toEqual([B]);
    const gone = deletePlaylist(library, "pl-1");
    expect(gone.playlists).toEqual([]);
    expect(gone.videos).toHaveLength(2);
  });

  it("says why a playlist is refused at each limit, and refuses the change", () => {
    const many = Array.from({ length: LIMITS.playlists }, (_, at) => ({
      id: `pl-${at}`,
      name: "P",
      videos: [],
    }));
    const full = { ...emptyLibrary, playlists: many };
    expect(noNewPlaylist(full)).toMatch(/50 playlists/);
    expect(addPlaylist(full, "pl-x", "X")).toBe(full);

    const ids = Array.from(
      { length: LIMITS.playlistVideos },
      (_, at) => `v${String(at).padStart(10, "0")}`,
    );
    const crowded = {
      ...emptyLibrary,
      playlists: [{ id: "pl-1", name: "Long", videos: ids }],
    };
    expect(noRoomInPlaylist(crowded, "pl-1", A)).toMatch(/holds 200 videos/);
    expect(noRoomInPlaylist(crowded, "pl-1", ids[0] as string)).toBeUndefined();
    expect(addToPlaylist(crowded, "pl-1", video(A))).toBe(crowded);
  });

  it("a library saved near the server's limit stays within it through every playlist change", () => {
    const near = {
      ...emptyLibrary,
      videos: Array.from({ length: 900 }, (_, at) => ({
        id: `n${String(at).padStart(10, "0")}`,
        title: "t".repeat(at < 9 ? 265 : 165),
        channel: "",
      })),
    };
    expect(libraryBytes(near)).toBeGreaterThan(LIMITS.bytes - 100);
    expect(libraryBytes(near)).toBeLessThanOrEqual(LIMITS.bytes);

    const lost = (library: TvLibraryState) => near.videos.length - library.videos.length;
    const made = addPlaylist(near, "pl-1", "n".repeat(LIMITS.playlistName));
    expect(libraryBytes(made)).toBeLessThanOrEqual(LIMITS.bytes);
    expect(made.playlists[0]?.name).toHaveLength(LIMITS.playlistName);
    expect(lost(made)).toBe(1);

    const small = addPlaylist(near, "pl-1", "a");
    const renamed = renamePlaylist(small, "pl-1", "n".repeat(LIMITS.playlistName));
    expect(libraryBytes(renamed)).toBeLessThanOrEqual(LIMITS.bytes);

    const listed = near.videos[899] as (typeof near.videos)[number];
    const added = addToPlaylist(made, "pl-1", listed);
    expect(libraryBytes(added)).toBeLessThanOrEqual(LIMITS.bytes);
    expect(added.playlists[0]?.videos).toEqual([listed.id]);
    expect(added.videos.some((each) => each.id === listed.id)).toBe(true);
  });

  it("cleans a name as the server requires", () => {
    expect(cleanPlaylistName("  a\nb\u0007 ")).toBe("ab");
    expect(Array.from(cleanPlaylistName("é".repeat(200)))).toHaveLength(LIMITS.playlistName);
  });

  it("a video made room for leaves its playlists too, so none names an unknown video", () => {
    const library = holding(A);
    let filled = library;
    for (let at = 0; at < LIMITS.videos; at += 1) {
      filled = know(filled, video(`n${String(at).padStart(10, "0")}`));
    }
    const known = new Set(filled.videos.map((each) => each.id));
    for (const id of order(filled) ?? []) expect(known.has(id)).toBe(true);
  });

  it("reads a library saved before playlists, and leaves the field out while there are none", () => {
    const { playlists: _none, ...old } = emptyLibrary;
    expect(tvLibraryFromServer({ library: old, rev: 3 })?.playlists).toEqual([]);
    expect(tvLibraryToServer(emptyLibrary).library).not.toHaveProperty("playlists");
    expect(tvLibraryToServer(holding(A)).library.playlists).toEqual([
      { id: "pl-1", name: "Evening", videos: [A] },
    ]);
    expect(tvLibraryFromServer({ library: { ...old, playlists: 3 }, rev: 3 })).toBeUndefined();
  });
});
