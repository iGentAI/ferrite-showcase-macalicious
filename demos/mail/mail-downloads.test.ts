import { afterEach, describe, expect, it, vi } from "vitest";
import type { Drive, DriveEntry } from "../desktop/desktop-files";
import { changeDesktopValue, desktopValues } from "../desktop/desktop-personal";
import { MAIL_DOWNLOADS, mailRunning, messageErased, noteMailDownload } from "./mail-downloads";
import { MAIL_SETTINGS } from "./mail-saved";

const drive = vi.hoisted(() => ({
  entries: [] as unknown[],
  ops: [] as unknown[],
}));

vi.mock("../desktop/desktop-files", async (original) => ({
  ...(await original<typeof import("../desktop/desktop-files")>()),
  loadDrive: async () => ({ entries: drive.entries, rev: 1, session: "s" }) as unknown as Drive,
  runOps: async (ops: unknown[]) => {
    drive.ops.push(...ops);
    return { entries: drive.entries, rev: 2, session: "s" } as unknown as Drive;
  },
}));

const file = (id: string, more: Partial<DriveEntry> = {}): DriveEntry => ({
  id,
  parent: "downloads",
  name: `${id}.txt`,
  kind: "file",
  size: 1,
  created_ms: 1,
  modified_ms: 1,
  version: 1,
  ...more,
});
const folder = (id: string): DriveEntry => ({ ...file(id), parent: undefined, kind: "folder" });
const listed = () => (desktopValues()[MAIL_DOWNLOADS] as { id: string }[]).map(({ id }) => id);
const settle = () => new Promise((resolve) => setTimeout(resolve, 0));

afterEach(() => {
  changeDesktopValue(MAIL_DOWNLOADS, undefined);
  changeDesktopValue(MAIL_SETTINGS, undefined);
  drive.ops.length = 0;
  drive.entries = [folder("downloads")];
});

describe("Remove unedited downloads", () => {
  it("after its message is erased, trashes only the files still as Mail saved them", async () => {
    for (const id of ["same", "saved-over", "renamed", "moved", "locked", "gone"]) {
      noteMailDownload(file(id), "m1");
    }
    noteMailDownload(file("other"), "m2");
    drive.entries = [
      folder("downloads"),
      file("same"),
      file("saved-over", { version: 2 }),
      file("renamed", { name: "Mine.txt" }),
      file("moved", { parent: "documents" }),
      file("locked", { locked: true }),
      file("other"),
    ];
    await messageErased("m1");
    expect(drive.ops).toEqual([{ op: "trash", id: "same" }]);
    expect(listed()).toEqual(["other"]);
  });

  it("under Never trashes nothing and forgets the message's files", async () => {
    changeDesktopValue(MAIL_SETTINGS, { remove: "Never" });
    noteMailDownload(file("a"), "m1");
    drive.entries = [folder("downloads"), file("a")];
    await messageErased("m1");
    expect(drive.ops).toEqual([]);
    expect(listed()).toEqual([]);
  });

  it("under When Mail Quits keeps them through the erase and trashes them when the last Mail goes", async () => {
    changeDesktopValue(MAIL_SETTINGS, { remove: "When Mail Quits" });
    noteMailDownload(file("a"), "m1");
    drive.entries = [folder("downloads"), file("a")];
    await messageErased("m1");
    expect(drive.ops).toEqual([]);
    expect(listed()).toEqual(["a"]);

    const first = mailRunning();
    const second = mailRunning();
    first();
    await settle();
    expect(drive.ops).toEqual([]);
    second();
    await vi.waitFor(() => expect(drive.ops).toEqual([{ op: "trash", id: "a" }]));
    await vi.waitFor(() => expect(listed()).toEqual([]));
  });

  it("does not act on a quit under the default", async () => {
    noteMailDownload(file("a"), "m1");
    drive.entries = [folder("downloads"), file("a")];
    mailRunning()();
    await settle();
    expect(drive.ops).toEqual([]);
    expect(listed()).toEqual(["a"]);
  });
});
