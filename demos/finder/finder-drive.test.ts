import { describe, expect, it } from "vitest";
import type { Drive, DriveEntry } from "../desktop/desktop-files";
import { HOME, listing, RECENTS, resolve, statusText, TRASH } from "./finder-data";
import { driveTree, isInTrash, kindOf, pathOfEntry, stampOf } from "./finder-drive";

const folder = (id: string, name: string, parent?: string): DriveEntry => ({
  id,
  name,
  parent,
  kind: "folder",
  size: 0,
  created_ms: 1_000,
  modified_ms: 2_000,
});

const file = (id: string, name: string, parent: string, extra: Partial<DriveEntry> = {}) => ({
  id,
  name,
  parent,
  kind: "file" as const,
  size: 1234,
  type: "text/plain",
  created_ms: 1_000,
  modified_ms: 2_000,
  ...extra,
});

function drive(entries: DriveEntry[]): Drive {
  return {
    rev: 3,
    usage: 5_000,
    quota: 128 * 1024 * 1024,
    piece_bytes: 196_608,
    max_file_bytes: 64 * 1024 * 1024,
    max_entries: 1000,
    entries: [
      folder("desktop", "Desktop"),
      folder("documents", "Documents"),
      folder("downloads", "Downloads"),
      folder("movies", "Movies"),
      folder("music", "Music"),
      folder("pictures", "Pictures"),
      ...entries,
    ],
  };
}

describe("Finder on the drive", () => {
  it("shows the drive's six folders in the home folder, and only the Applications beside it", () => {
    const root = driveTree(drive([]));
    expect(listing(root, HOME).map((entry) => entry.node.name)).toEqual([
      "Desktop",
      "Documents",
      "Downloads",
      "Movies",
      "Music",
      "Pictures",
    ]);
    expect(listing(root, "/").map((entry) => entry.node.name)).toEqual(["Applications", "Users"]);
    expect(resolve(root, "/Volumes")).toBeUndefined();
    expect(resolve(root, `${HOME}/Documents`)?.id).toBe("documents");
    expect(resolve(root, "/Applications/Calculator")?.kind).toBe("application");
  });

  it("leaves the apps the Ferrite desktop does not deploy out of Applications", () => {
    const root = driveTree(drive([]));
    for (const gone of [
      "/Applications/Utilities/AirPort Utility",
      "/Applications/Utilities/Boot Camp Assistant",
      "/Applications/Utilities/Disk Utility",
    ]) {
      expect(resolve(root, gone)).toBeUndefined();
    }
    expect(resolve(root, "/Applications/Utilities/Console")?.kind).toBe("application");
    expect(resolve(root, "/Applications/Home")?.kind).toBe("application");
  });

  it("puts each entry in its folder with its size, type, dates and tags", () => {
    const root = driveTree(
      drive([
        folder("f1", "Letters", "documents"),
        file("a", "Note.txt", "f1", { tags: ["Red"], opened_ms: 3_000 }),
        file("b", "Sea.png", "pictures", { type: "image/png" }),
      ]),
    );
    const note = resolve(root, `${HOME}/Documents/Letters/Note.txt`);
    expect(note).toMatchObject({ id: "a", kind: "document", size: 1234, tags: ["Red"] });
    expect(note?.modified).toBe(stampOf(2_000));
    expect(note?.opened).toBe(stampOf(3_000));
    expect(resolve(root, `${HOME}/Pictures/Sea.png`)).toMatchObject({
      kind: "image",
      kindLabel: "PNG image",
    });
    expect(pathOfEntry(root, "a")).toBe(`${HOME}/Documents/Letters/Note.txt`);
  });

  it("keeps the Trash in the home folder's hidden .Trash, with what is inside a trashed folder", () => {
    const root = driveTree(
      drive([
        { ...folder("f1", "Old", "documents"), trashed_ms: 5_000 },
        file("a", "Inside.txt", "f1"),
        file("b", "Kept.txt", "documents"),
      ]),
    );
    expect(listing(root, `${HOME}/Documents`).map((entry) => entry.node.name)).toEqual([
      "Kept.txt",
    ]);
    expect(listing(root, TRASH).map((entry) => entry.node.name)).toEqual(["Old"]);
    expect(pathOfEntry(root, "a")).toBe(`${TRASH}/Old/Inside.txt`);
    expect(isInTrash(`${TRASH}/Old/Inside.txt`)).toBe(true);
    expect(isInTrash(`${HOME}/Documents`)).toBe(false);
    expect(listing(root, HOME).some((entry) => entry.node.name === ".Trash")).toBe(false);
  });

  it("gives trashed items of one name a path each, which never passes to another item", () => {
    const trashed = [
      { ...file("a1b2c3d4", "Note.txt", "documents"), trashed_ms: 5_000 },
      { ...file("e5f6a7b8", "note.txt", "desktop"), trashed_ms: 6_000 },
      { ...folder("f1", "Old", "documents"), trashed_ms: 7_000 },
      { ...folder("f2", "Old", "desktop"), trashed_ms: 8_000 },
    ];
    const root = driveTree(drive(trashed));
    const ids = ["a1b2c3d4", "e5f6a7b8", "f1", "f2"];
    const paths = ids.map((id) => pathOfEntry(root, id));
    expect(new Set(paths).size).toBe(4);
    for (const [index, id] of ids.entries()) {
      expect(resolve(root, paths[index] as string)?.id).toBe(id);
    }
    expect(
      listing(root, TRASH)
        .map((entry) => entry.node.name)
        .sort(),
    ).toEqual(["Note a1b2c3.txt", "Old f1", "Old f2", "note e5f6a7.txt"].sort());
    // The first is put back: the other keeps its entry, and the paths the window held for
    // either never lead to the wrong one.
    const after = driveTree(
      drive([file("a1b2c3d4", "Note.txt", "documents"), ...trashed.slice(1)]),
    );
    for (const path of paths.slice(0, 2)) {
      const now = resolve(after, path as string);
      expect(now === undefined || now.id === "e5f6a7b8" || now.id === "a1b2c3d4").toBe(true);
    }
    expect(resolve(after, paths[0] as string)).toBeUndefined();
    expect(resolve(after, `${TRASH}/note.txt`)?.id).toBe("e5f6a7b8");
  });

  it("lists the files last opened or changed in Recents, and the space left in the status bar", () => {
    const root = driveTree(
      drive([
        file("a", "Old.txt", "documents", { modified_ms: 1_000 }),
        file("b", "Opened.txt", "desktop", { modified_ms: 1_000, opened_ms: 9_000 }),
        file("c", "Changed.txt", "documents", { modified_ms: 5_000 }),
        { ...file("d", "Gone.txt", "documents", { modified_ms: 10_000 }), trashed_ms: 11_000 },
      ]),
    );
    expect(listing(root, RECENTS).map((entry) => entry.node.name)).toEqual([
      "Opened.txt",
      "Changed.txt",
      "Old.txt",
    ]);
    expect(root.available).toBe(128 * 1024 * 1024 - 5_000);
    expect(statusText(3, 0, root.available)).toBe("3 items, 134 MB available");
    expect(statusText(3, 1)).toBe("1 of 3 selected, 212.4 GB available");
  });

  it("shows the six folders, empty, before the drive has loaded", () => {
    const root = driveTree(null);
    expect(listing(root, HOME)).toHaveLength(6);
    expect(root.available).toBeUndefined();
  });

  it("tells a file's kind from its type, else from its extension", () => {
    const kind = (name: string, type?: string) => kindOf({ kind: "file", name, type });
    expect(kind("a", "image/jpeg")).toBe("image");
    expect(kind("a.bin", "application/pdf")).toBe("pdf");
    expect(kind("Song.mp3")).toBe("audio");
    expect(kind("Clip", "video/mp4")).toBe("movie");
    expect(kind("Book.epub")).toBe("book");
    expect(kind("notes.md")).toBe("document");
    expect(kind("archive.zip", "application/zip")).toBe("file");
    expect(kindOf({ kind: "folder", name: "x.png" })).toBe("folder");
  });
});
