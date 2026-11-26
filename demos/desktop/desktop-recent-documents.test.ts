import { describe, expect, it } from "vitest";
import type { Drive } from "./desktop-files";
import { recentDocuments, shelfDocuments } from "./desktop-recent-documents";

const file = (id: string, opened_ms?: number, parent = "documents") => ({
  id,
  name: id,
  kind: "file",
  parent,
  size: 1,
  version: 1,
  created_ms: 1,
  modified_ms: 500,
  ...(opened_ms === undefined ? {} : { opened_ms }),
});

const drive = {
  entries: [file("never"), file("old", 100), file("new", 300), file("mid", 200)],
} as unknown as Drive;

const names = (clearedAt: number, count: number) =>
  recentDocuments(drive, clearedAt, count).map((entry) => entry.name);

describe("App Exposé's shelf", () => {
  const mine = (entry: { name: string }) => entry.name.startsWith("mine");
  const shelf = (entries: unknown[]) =>
    shelfDocuments({ entries } as unknown as Drive, 0, mine).map((entry) => entry.name);

  it("keeps an application's document however many of others' came after it", () => {
    const others = Array.from({ length: 40 }, (_, at) => file(`other${at}`, 1000 + at));
    expect(shelf([file("mine", 10), ...others])).toEqual(["mine"]);
  });

  it("holds the newest eight", () => {
    const mineAll = Array.from({ length: 10 }, (_, at) => file(`mine${at}`, 100 + at));
    expect(shelf(mineAll)).toEqual([9, 8, 7, 6, 5, 4, 3, 2].map((at) => `mine${at}`));
  });
});

describe("the documents of Recent Items", () => {
  it("are the files opened, newest first, as many as asked", () => {
    expect(names(0, 10)).toEqual(["new", "mid", "old"]);
    expect(names(0, 2)).toEqual(["new", "mid"]);
  });

  it("leave out what was opened before the menu was cleared", () => {
    expect(names(200, 10)).toEqual(["new"]);
  });

  it("are none without a drive", () => {
    expect(recentDocuments(null, 0, 10)).toEqual([]);
  });
});
