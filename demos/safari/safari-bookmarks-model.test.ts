import { describe, expect, it } from "vitest";
import {
  movedRows,
  type SafariLibrary,
  withFolderRenamed,
  withoutFolder,
  withoutRows,
} from "./safari-bookmarks-model";

const link = (title: string) => ({ title, url: `https://${title}.org/` });
const library: SafariLibrary = {
  favorites: [link("a")],
  bookmarks: [link("b"), link("c"), link("d")],
  folders: [{ title: "News", links: [link("e")] }],
};
const titles = (links: readonly { title: string }[]) => links.map((one) => one.title).join();

describe("Safari's bookmark rows", () => {
  it("deletes several rows from several places by their first positions", () => {
    const next = withoutRows(library, [
      { place: "bookmarks", index: 0 },
      { place: "bookmarks", index: 2 },
      { place: "folder:News", index: 0 },
    ]);
    expect(titles(next.bookmarks)).toBe("c");
    expect(titles(next.folders[0]?.links ?? [])).toBe("");
    expect(titles(next.favorites)).toBe("a");
  });

  it("moves rows to the end of a place and leaves the rows already there", () => {
    const next = movedRows(
      library,
      [
        { place: "bookmarks", index: 1 },
        { place: "folder:News", index: 0 },
      ],
      "bookmarks",
    );
    expect(titles(next.bookmarks)).toBe("b,c,d,e");
    expect(titles(next.folders[0]?.links ?? [])).toBe("");
  });

  it("does not hold the same name and address twice after a move", () => {
    const next = movedRows(
      { ...library, favorites: [link("b")] },
      [{ place: "bookmarks", index: 0 }],
      "favorites",
    );
    expect(titles(next.favorites)).toBe("b");
    expect(titles(next.bookmarks)).toBe("c,d");
  });

  it("renames and deletes a folder", () => {
    expect(withFolderRenamed(library, "News", "Daily").folders[0]?.title).toBe("Daily");
    expect(withoutFolder(library, "News").folders).toEqual([]);
  });
});
