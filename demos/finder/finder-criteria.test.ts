import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  type CriterionField,
  type FinderCriterion,
  matchesCriterion,
  newCriterion,
} from "./finder-criteria";
import { type FinderNode, search } from "./finder-data";

const NOW = new Date(2026, 9, 21, 12, 0);
const file = (node: Partial<FinderNode>): FinderNode => ({
  name: "Report.pdf",
  kind: "pdf",
  ...node,
});
const matches = (node: FinderNode, row: FinderCriterion, hits?: ReadonlySet<string>) =>
  matchesCriterion(node, row, hits, NOW);
const row = (field: CriterionField, op: string, value: string): FinderCriterion => ({
  field,
  op,
  value,
});

describe("a search's criterion rows", () => {
  it("Kind", () => {
    expect(matches(file({}), row("kind", "is", "any"))).toBe(true);
    expect(matches(file({}), row("kind", "is", "pdf"))).toBe(true);
    expect(matches(file({}), row("kind", "is", "document"))).toBe(true);
    expect(matches(file({}), row("kind", "is", "image"))).toBe(false);
    expect(matches(file({ name: "a.zip", kind: "file" }), row("kind", "is", "archive"))).toBe(true);
    expect(matches(file({ name: "a.md", kind: "file" }), row("kind", "is", "text"))).toBe(true);
    expect(matches(file({ name: "s.key", kind: "file" }), row("kind", "is", "presentation"))).toBe(
      true,
    );
    expect(matches(file({ name: "m", kind: "folder" }), row("kind", "is", "folder"))).toBe(true);
    expect(matches(file({ name: "m", kind: "audio" }), row("kind", "is", "music"))).toBe(true);
  });

  it("Kind of a folder is only Folder or Any, whatever its name says", () => {
    for (const name of ["notes.txt", "slides.pptx", "backup.zip"]) {
      const folder = file({ name, kind: "folder", children: [] });
      expect(matches(folder, row("kind", "is", "folder"))).toBe(true);
      expect(matches(folder, row("kind", "is", "any"))).toBe(true);
      for (const kind of ["text", "document", "presentation", "archive"]) {
        expect(matches(folder, row("kind", "is", kind))).toBe(false);
      }
    }
  });

  it("Name, whatever the case", () => {
    expect(matches(file({}), row("name", "contains", "PORT"))).toBe(true);
    expect(matches(file({}), row("name", "begins", "rep"))).toBe(true);
    expect(matches(file({}), row("name", "begins", "port"))).toBe(false);
    expect(matches(file({}), row("name", "ends", ".pdf"))).toBe(true);
    expect(matches(file({}), row("name", "is", "report.pdf"))).toBe(true);
    expect(matches(file({}), row("name", "is", "report"))).toBe(false);
  });

  it("holds for everything while its text is empty", () => {
    for (const field of ["name", "contents", "extension", "tags"] as const) {
      expect(matches(file({}), newCriterion(field))).toBe(true);
    }
  });

  it("Contents, from the server's hits", () => {
    const hit = new Set(["a"]);
    expect(matches(file({ id: "a" }), row("contents", "contains", "w"), hit)).toBe(true);
    expect(matches(file({ id: "b" }), row("contents", "contains", "w"), hit)).toBe(false);
    expect(matches(file({}), row("contents", "contains", "w"), hit)).toBe(false);
  });

  it("File extension, with or without the dot", () => {
    expect(matches(file({}), row("extension", "is", "PDF"))).toBe(true);
    expect(matches(file({}), row("extension", "is", ".pdf"))).toBe(true);
    expect(matches(file({}), row("extension", "is", "p"))).toBe(false);
    expect(matches(file({ name: ".hidden" }), row("extension", "is", "hidden"))).toBe(false);
  });

  it("Tags", () => {
    expect(matches(file({ tags: ["Red", "Work"] }), row("tags", "contains", "wor"))).toBe(true);
    expect(matches(file({ tags: ["Red"] }), row("tags", "contains", "wor"))).toBe(false);
    expect(matches(file({}), row("tags", "contains", "wor"))).toBe(false);
  });

  it("File size, in its unit", () => {
    const big = file({ size: 2_500_000 });
    expect(matches(big, { ...row("size", "greater", "2"), unit: "MB" })).toBe(true);
    expect(matches(big, { ...row("size", "less", "2"), unit: "MB" })).toBe(false);
    expect(matches(big, { ...row("size", "greater", "2600"), unit: "KB" })).toBe(false);
    expect(matches(file({}), { ...row("size", "greater", "0"), unit: "KB" })).toBe(false);
  });

  it("a date, against today", () => {
    const at = (modified: string) => file({ modified });
    expect(matches(at("2026-10-21 09:00"), row("modified", "today", ""))).toBe(true);
    expect(matches(at("2026-10-20 09:00"), row("modified", "today", ""))).toBe(false);
    expect(matches(at("2026-10-20 09:00"), row("modified", "yesterday", ""))).toBe(true);
    expect(matches(at("2026-10-15 09:00"), row("modified", "within", "7"))).toBe(true);
    expect(matches(at("2026-10-13 09:00"), row("modified", "within", "7"))).toBe(false);
    expect(matches(at("2026-10-18 09:00"), row("modified", "week", ""))).toBe(true);
    expect(matches(at("2026-10-17 09:00"), row("modified", "week", ""))).toBe(false);
    expect(matches(at("2026-10-01 00:00"), row("modified", "month", ""))).toBe(true);
    expect(matches(at("2026-09-30 23:00"), row("modified", "month", ""))).toBe(false);
    expect(matches(at("2026-01-01 00:00"), row("modified", "year", ""))).toBe(true);
    expect(matches(at("2025-12-31 23:00"), row("modified", "year", ""))).toBe(false);
    expect(matches(at("2026-10-01 09:00"), row("modified", "before", "2026-10-02"))).toBe(true);
    expect(matches(at("2026-10-02 09:00"), row("modified", "before", "2026-10-02"))).toBe(false);
    expect(matches(at("2026-10-03 09:00"), row("modified", "after", "2026-10-02"))).toBe(true);
    expect(matches(at("2026-10-02 09:00"), row("modified", "after", "2026-10-02"))).toBe(false);
    expect(matches(file({}), row("opened", "today", ""))).toBe(false);
  });

  it("a date, not past the end of its period", () => {
    const at = (modified: string) => file({ modified });
    expect(matches(at("2026-10-22 00:00"), row("modified", "today", ""))).toBe(false);
    expect(matches(at("2026-10-21 13:00"), row("modified", "within", "7"))).toBe(false);
    expect(matches(at("2026-10-21 11:00"), row("modified", "within", "7"))).toBe(true);
    // 21 October 2026 is a Wednesday: its week runs from Sunday the 18th to Saturday the 24th.
    expect(matches(at("2026-10-24 23:00"), row("modified", "week", ""))).toBe(true);
    expect(matches(at("2026-10-25 00:00"), row("modified", "week", ""))).toBe(false);
    expect(matches(at("2026-11-01 00:00"), row("modified", "month", ""))).toBe(false);
    expect(matches(at("2027-01-01 00:00"), row("modified", "year", ""))).toBe(false);
  });

  describe("where a day can have 23 or 25 hours", () => {
    const zone = process.env.TZ;
    beforeEach(() => {
      process.env.TZ = "America/New_York";
    });
    afterEach(() => {
      if (zone === undefined) delete process.env.TZ;
      else process.env.TZ = zone;
    });
    const at = (modified: string) => file({ modified });
    const on = (stamp: string, op: string, now: Date, value = "") =>
      matchesCriterion(at(stamp), row("modified", op, value), undefined, now);

    it("the clocks going forward, on 8 March 2026", () => {
      const after = new Date(2026, 2, 9, 12, 0);
      expect(on("2026-03-07 23:30", "yesterday", after)).toBe(false);
      expect(on("2026-03-08 00:30", "yesterday", after)).toBe(true);
      const tuesday = new Date(2026, 2, 10, 12, 0);
      expect(on("2026-03-07 23:30", "week", tuesday)).toBe(false);
      expect(on("2026-03-08 00:30", "week", tuesday)).toBe(true);
      expect(on("2026-03-09 00:30", "after", after, "2026-03-08")).toBe(true);
      expect(on("2026-03-08 23:30", "after", after, "2026-03-08")).toBe(false);
    });

    it("the clocks going back, on 1 November 2026", () => {
      const after = new Date(2026, 10, 2, 12, 0);
      expect(on("2026-11-01 00:30", "yesterday", after)).toBe(true);
      expect(on("2026-10-31 23:30", "yesterday", after)).toBe(false);
      const sunday = new Date(2026, 10, 1, 12, 0);
      expect(on("2026-11-07 23:30", "week", sunday)).toBe(true);
      expect(on("2026-11-08 00:30", "week", sunday)).toBe(false);
      expect(on("2026-11-01 23:30", "after", after, "2026-11-01")).toBe(false);
      expect(on("2026-11-02 00:30", "after", after, "2026-11-01")).toBe(true);
    });
  });
});

describe("a search of rows alone", () => {
  const root: FinderNode = {
    name: "",
    kind: "folder",
    children: [
      { name: "a.pdf", kind: "pdf" },
      { name: "b.png", kind: "image" },
      { name: "Inner", kind: "folder", children: [{ name: "c.pdf", kind: "pdf" }] },
    ],
  };

  it("needs no query, and goes through folders", () => {
    const found = search(root, "/", "", [row("kind", "is", "pdf")]);
    expect(found.map(({ node }) => node.name)).toEqual(["a.pdf", "c.pdf"]);
  });

  it("finds nothing with neither", () => {
    expect(search(root, "/", "", [])).toEqual([]);
  });
});
