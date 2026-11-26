import { describe, expect, it } from "vitest";
import { folderAndInside, moveToFolder, songsInFolder, withoutFolder } from "./music-folders";
import { applyLibraryChange } from "./music-history";
import type { MusicLibraryState } from "./music-server";

const library: MusicLibraryState = {
  songs: [],
  loved: [],
  folders: [
    { id: "outer", name: "Outer" },
    { id: "inner", name: "Inner", parent: "outer" },
    { id: "other", name: "Other" },
  ],
  playlists: [
    { id: "a", name: "A", songs: ["1", "2"], folder: "outer" },
    { id: "b", name: "B", songs: ["2", "3"], folder: "inner" },
    { id: "c", name: "C", songs: ["4"] },
  ],
};

describe("Music's playlist folders", () => {
  it("counts a folder's songs through the folders inside it, each once", () => {
    expect([...folderAndInside(library, "outer")]).toEqual(["outer", "inner"]);
    expect(songsInFolder(library, "outer")).toEqual(["1", "2", "3"]);
    expect(songsInFolder(library, "other")).toEqual([]);
  });

  it("does not put a folder inside itself or a folder within it", () => {
    expect(moveToFolder(library, "folder:outer", "inner")).toBe(library);
    expect(moveToFolder(library, "folder:outer", "outer")).toBe(library);
    expect(
      moveToFolder(library, "folder:inner", null).folders?.find((f) => f.id === "inner")?.parent,
    ).toBeNull();
  });

  it("deletes a folder with what is in it and nothing else", () => {
    const left = withoutFolder(library, "outer");
    expect(left.folders?.map((f) => f.id)).toEqual(["other"]);
    expect(left.playlists.map((p) => p.id)).toEqual(["c"]);
  });

  it("Undo of a deletion brings back the folder and its playlists", () => {
    const left = withoutFolder(library, "outer");
    const back = applyLibraryChange(left, left, library);
    expect(back.folders?.map((f) => f.id).sort()).toEqual(["inner", "other", "outer"]);
    expect(back.playlists.find((p) => p.id === "b")?.folder).toBe("inner");
  });

  it("moves to the top a playlist whose folder another window deleted", () => {
    const moved = moveToFolder(library, "playlist:c", "other");
    const elsewhere = { ...library, folders: library.folders?.filter((f) => f.id !== "other") };
    const merged = applyLibraryChange(elsewhere, library, moved);
    expect(merged.playlists.find((p) => p.id === "c")?.folder).toBeNull();
  });

  it("moves to the top a folder two windows put inside each other", () => {
    const elsewhere = moveToFolder(library, "folder:other", "inner");
    const mine = moveToFolder(library, "folder:outer", "other");
    const merged = applyLibraryChange(elsewhere, library, mine);
    expect(merged.folders?.filter((f) => !f.parent).length).toBeGreaterThan(0);
    const byId = new Map(merged.folders?.map((f) => [f.id, f]));
    for (const folder of merged.folders ?? []) {
      const seen = new Set([folder.id]);
      for (let up = folder.parent; up; up = byId.get(up)?.parent) {
        expect(seen.has(up)).toBe(false);
        seen.add(up);
      }
    }
  });
});
