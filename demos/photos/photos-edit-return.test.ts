import { beforeEach, describe, expect, it, vi } from "vitest";
import type { DriveEntry } from "../desktop/desktop-files";
import * as personal from "../desktop/desktop-personal";
import { editFromServer, isIdentity, NO_EDIT, withoutFile } from "./photos-edit";
import { copyForPreview, returnToPhotos } from "./photos-edit-return";
import {
  EDIT_WITH,
  editedFileOf,
  editWithCopies,
  keepCopy,
  MOST_RECORDED,
} from "./photos-edit-with";
import type { LibraryPhoto } from "./photos-library";
import * as library from "./photos-library";

const uploads: { name?: string; size: number }[] = [];
vi.mock("../desktop/desktop-files", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../desktop/desktop-files")>()),
  loadDrive: vi.fn(async () => ({ entries: [{ id: "copy-1", name: "Beach.jpg" }] })),
  entryOf: (drive: { entries: DriveEntry[] }, id: string) =>
    drive.entries.find((each) => each.id === id),
  uploadFile: vi.fn(async (data: Blob, _folder: string, options: { name?: string }) => {
    uploads.push({ name: options.name, size: data.size });
    return { id: `copy-${uploads.length}`, name: options.name, type: "image/jpeg" };
  }),
}));
vi.mock("./photos-drive", async (importOriginal) => ({
  ...(await importOriginal<typeof import("./photos-drive")>()),
  picturesFolder: vi.fn(async () => "edits"),
  deleteDriveFile: vi.fn(async () => {}),
}));
vi.mock("./photos-library", async (importOriginal) => ({
  ...(await importOriginal<typeof import("./photos-library")>()),
  changePhoto: vi.fn(),
  decodePicture: vi.fn(async () => ({ width: 4, height: 3, close: () => {} })),
  thumbnailOf: vi.fn(async () => new Blob(["thumb"])),
  readOriginal: vi.fn(async () => new Blob(["original"])),
}));

const beach = {
  id: "p1",
  file: "f1",
  name: "Beach",
  mime: "image/jpeg",
  edit: null,
  edited_ms: null,
} as unknown as LibraryPhoto;
const saved = { id: "saved-1", name: "Beach.jpg" } as DriveEntry;

beforeEach(() => {
  uploads.length = 0;
  personal.changeDesktopValue(EDIT_WITH, {});
  vi.mocked(library.changePhoto).mockReset();
  vi.mocked(library.changePhoto).mockImplementation(async () => ({
    ...beach,
    edit: { ...NO_EDIT, external: "saved-1" },
    edited_ms: 77,
  }));
});

describe("Edit With Preview", () => {
  it("opens a copy, not the original, and the same copy again until it is saved", async () => {
    const first = await copyForPreview(beach, "Beach.jpg");
    expect(first.id).toBe("copy-1");
    expect(uploads).toEqual([{ name: "Beach.jpg", size: 8 }]);
    expect(editWithCopies().f1).toEqual({ photo: "p1", open: "copy-1", at: 0 });
    const again = await copyForPreview(beach, "Beach.jpg");
    expect(again.id).toBe("copy-1");
    expect(uploads).toHaveLength(1);
    // Nothing has come back yet: the photo is drawn from its original.
    expect(editedFileOf("f1")).toBeUndefined();
  });

  it("brings what Preview saved back as the photo's edit, and follows the next save", async () => {
    await copyForPreview(beach, "Beach.jpg");
    expect(await returnToPhotos("copy-1", saved, new Blob(["edited"]))).toBe(true);
    const [id, change] = vi.mocked(library.changePhoto).mock.calls[0] ?? [];
    expect(id).toBe("p1");
    expect(change?.edit).toEqual({ ...NO_EDIT, external: "saved-1" });
    expect(change?.thumb).toBeInstanceOf(Blob);
    expect(editedFileOf("f1")).toBe("saved-1");
    expect(await returnToPhotos("saved-1", { ...saved, id: "saved-2" }, new Blob(["x"]))).toBe(
      true,
    );
    expect(editedFileOf("f1")).toBe("saved-2");
  });

  it("leaves any other file Preview saves alone", async () => {
    expect(await returnToPhotos("elsewhere", saved, new Blob(["edited"]))).toBe(false);
    expect(library.changePhoto).not.toHaveBeenCalled();
  });

  it("keeps the file in the edit: a real edit, read back from the server, draws nothing more", () => {
    const edit = { ...NO_EDIT, external: "saved-1" };
    expect(isIdentity(edit)).toBe(false);
    expect(editFromServer(edit)?.external).toBe("saved-1");
    expect(withoutFile(edit)).toEqual(NO_EDIT);
    expect(isIdentity(withoutFile(edit))).toBe(true);
  });

  it("takes a photo past the record's size: the oldest kept file's record makes room", async () => {
    for (let n = 0; n < MOST_RECORDED + 5; n += 1) {
      keepCopy(`f${n}`, { photo: `p${n}`, open: `s${n}`, base: `s${n}`, at: n, held: true });
    }
    const copies = editWithCopies();
    expect(Object.keys(copies)).toHaveLength(MOST_RECORDED);
    expect(copies.f0).toBeUndefined();
    expect(copies[`f${MOST_RECORDED + 4}`]?.open).toBe(`s${MOST_RECORDED + 4}`);
    const first = await copyForPreview(beach, "Beach.jpg");
    expect(first.id).toBe("copy-1");
    expect(Object.keys(editWithCopies())).toHaveLength(MOST_RECORDED);
  });

  it("never drops a record that is all there is of an edit made before edits named a file", () => {
    keepCopy("old", { photo: "p-old", open: "s-old", base: "s-old", at: 0 });
    for (let n = 0; n < MOST_RECORDED + 2; n += 1) {
      keepCopy(`f${n}`, { photo: `p${n}`, open: `s${n}`, base: `s${n}`, at: n + 1, held: true });
    }
    expect(editedFileOf("old")).toBe("s-old");
  });

  it("opens what Preview last saved of a photo whose record has gone, with a new record", async () => {
    const edited = {
      ...beach,
      edit: { ...NO_EDIT, external: "copy-1" },
      edited_ms: 77,
    } as LibraryPhoto;
    const opened = await copyForPreview(edited, "Beach.jpg");
    expect(opened.id).toBe("copy-1");
    expect(uploads).toHaveLength(0);
    expect(editWithCopies().f1).toEqual({
      photo: "p1",
      open: "copy-1",
      base: "copy-1",
      at: 77,
      held: true,
    });
  });
});
