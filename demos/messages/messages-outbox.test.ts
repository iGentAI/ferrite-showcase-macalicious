import { beforeEach, describe, expect, it, vi } from "vitest";
import { type OutboxEntry, readOutbox, writeOutbox } from "./messages-outbox";

const entry = (key: string, change: Partial<OutboxEntry> = {}): OutboxEntry => ({
  conversation: `c-${"a".repeat(32)}`,
  key,
  text: `text of ${key}`,
  at: "9:41 AM",
  written: 1000,
  ...change,
});
const keys = (me: string, now?: number) => readOutbox(me, now).map((each) => each.key);

describe("the outbox", () => {
  beforeEach(() => window.localStorage.clear());

  it("reads back what was written, per account, oldest first", () => {
    writeOutbox("chris", [entry("b", { written: 2000 }), entry("a")], new Set());
    expect(keys("chris")).toEqual(["a", "b"]);
    expect(keys("martin")).toEqual([]);
  });

  it("keeps a message two windows write at once, each from what it read before", () => {
    readOutbox("chris");
    readOutbox("chris");
    writeOutbox("chris", [entry("first")], new Set());
    writeOutbox("chris", [entry("second", { written: 2000 })], new Set());
    expect(keys("chris")).toEqual(["first", "second"]);
  });

  it("removes only what this window finished", () => {
    writeOutbox("chris", [entry("other"), entry("mine")], new Set());
    writeOutbox("chris", [], new Set(["mine"]));
    expect(keys("chris")).toEqual(["other"]);
  });

  it("keeps a message the server was never reached with for as long as it takes", () => {
    writeOutbox("chris", [entry("unreached", { failed: true })], new Set());
    expect(keys("chris", 400 * 86_400_000)).toEqual(["unreached"]);
  });

  it("drops a refused message after a month", () => {
    writeOutbox("chris", [entry("refused", { failed: true, refused: true })], new Set());
    expect(keys("chris", 29 * 86_400_000)).toEqual(["refused"]);
    expect(keys("chris", 31 * 86_400_000)).toEqual([]);
    expect(window.localStorage.length).toBe(0);
  });

  it("says when storage refuses a message", () => {
    const refusing = vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new Error("quota");
    });
    expect(writeOutbox("chris", [entry("a")], new Set())).toBe(false);
    refusing.mockRestore();
    expect(writeOutbox("chris", [entry("a")], new Set())).toBe(true);
  });

  it("leaves out a record it cannot read", () => {
    window.localStorage.setItem("macalicious.messages.outbox.chris.x", "{not json");
    window.localStorage.setItem("macalicious.messages.outbox.chris.y", '{"key":"y"}');
    expect(keys("chris")).toEqual([]);
  });
});
