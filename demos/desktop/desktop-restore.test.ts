import { afterEach, describe, expect, it } from "vitest";
import {
  claimLoginItems,
  fitFrame,
  forgetLoginItems,
  journaledWindows,
  journalWindows,
  keptWindows,
  readSavedWindows,
} from "./desktop-restore";

const window = (id: string, frame = { x: 10, y: 30, width: 400, height: 300 }) => ({
  id,
  app: id.split(":")[0] as string,
  ...frame,
});

afterEach(() => sessionStorage.clear());

describe("the windows kept for a reload", () => {
  it("reads what is well formed and drops the rest", () => {
    expect(
      readSavedWindows([
        window("notes"),
        window("finder:2"),
        { id: "../etc", app: "notes", x: 0, y: 0, width: 1, height: 1 },
        { id: "mail", app: "mail", x: "0", y: 0, width: 1, height: 1 },
        null,
      ])?.map((each) => each.id),
    ).toEqual(["notes", "finder:2"]);
    expect(readSavedWindows("notes")).toBeUndefined();
  });

  it("keeps the windows last key when there are too many to store", () => {
    const many = Array.from({ length: 40 }, (_, index) => window(`app-${index}`));
    const kept = keptWindows(many);
    expect(kept).toHaveLength(30);
    expect(kept[0]?.id).toBe("app-10");
    expect(kept.at(-1)?.id).toBe("app-39");
    expect(JSON.stringify(kept).length).toBeLessThan(4096);
  });

  it("stays within a setting's bytes with long ids and fractional frames, keeping the newest", () => {
    const frame = { x: 100.123456789, y: 200.123456789, width: 640.987654321, height: 480.987654 };
    const many = Array.from({ length: 30 }, (_, index) =>
      window(`${"long-app-name-".repeat(4)}${index}`.slice(-64), frame),
    );
    const kept = keptWindows(many);
    expect(new TextEncoder().encode(JSON.stringify(kept)).length).toBeLessThanOrEqual(4096);
    expect(kept.length).toBeGreaterThan(0);
    expect(kept.at(-1)?.id).toBe(many.at(-1)?.id);
  });

  it("brings a window kept off this screen back within reach", () => {
    const room = { width: 1024, height: 700, top: 22 };
    expect(fitFrame({ x: 3000, y: 2000, width: 400, height: 300 }, room)).toEqual({
      x: 944,
      y: 620,
      width: 400,
      height: 300,
    });
    expect(fitFrame({ x: -900, y: 0, width: 400, height: 300 }, room)).toEqual({
      x: -320,
      y: 22,
      width: 400,
      height: 300,
    });
    // Saved on a laptop, restored on a phone: no wider than the screen.
    expect(
      fitFrame({ x: 8, y: 36, width: 1080, height: 756 }, { width: 390, height: 844, top: 22 }),
    ).toEqual({
      x: 8,
      y: 36,
      width: 374,
      height: 756,
    });
  });
});

describe("the login items", () => {
  it("open once per account in a tab, not again on a reload", () => {
    expect(claimLoginItems("ann")).toBe(true);
    expect(claimLoginItems("ann")).toBe(false);
    expect(claimLoginItems("bob")).toBe(true);
    expect(claimLoginItems("ann")).toBe(false);
  });

  it("open again at the login after a log-out", () => {
    expect(claimLoginItems("ann")).toBe(true);
    forgetLoginItems();
    expect(claimLoginItems("ann")).toBe(true);
    expect(claimLoginItems("ann")).toBe(false);
  });
});

describe("the tab's own note of its windows", () => {
  it("comes back per account, and is absent where none was made", () => {
    expect(journaledWindows("ann")).toBeUndefined();
    journalWindows("ann", [window("notes")]);
    journalWindows("bob", []);
    expect(journaledWindows("ann")?.map((each) => each.id)).toEqual(["notes"]);
    expect(journaledWindows("bob")).toEqual([]);
  });
});
