import { describe, expect, it } from "vitest";
import { mergeSettings } from "./storage";

const theme = (appearance: string) => ({ appearance, accent: "blue", highlight: null });

describe("mergeSettings", () => {
  it("keeps the settings changed elsewhere beside the one changed here", () => {
    const base = { values: { "dock.size": 1, "dock.magnify": false }, theme: theme("light") };
    const mine = { values: { "dock.size": 2, "dock.magnify": false }, theme: theme("light") };
    const theirs = { values: { "dock.size": 1, "dock.magnify": true }, theme: theme("dark") };
    expect(mergeSettings(base, mine, theirs)).toEqual({
      values: { "dock.size": 2, "dock.magnify": true },
      theme: theme("dark"),
    });
  });

  it("keeps a change made after the settings were forgotten elsewhere, and nothing else", () => {
    const base = { values: { "dock.size": 1, "dock.magnify": true }, theme: theme("dark") };
    const forgotten = { values: null, theme: null };
    // The page still holds the old settings, and changes one of them.
    const mine = { values: { "dock.size": 2, "dock.magnify": true }, theme: theme("dark") };
    expect(mergeSettings(base, mine, forgotten)).toEqual({
      values: { "dock.size": 2 },
      theme: null,
    });
    // A list setting changed here is kept as the person left it, whole.
    const order = { values: { "dock.order": ["a", "b", "c"] }, theme: null };
    expect(
      mergeSettings(order, { values: { "dock.order": ["c", "a", "b"] }, theme: null }, forgotten),
    ).toEqual({ values: { "dock.order": ["c", "a", "b"] }, theme: null });
    // A theme chosen here is kept whole, never in part.
    const chosen = { ...base, theme: { appearance: "light", accent: "blue", highlight: null } };
    expect(mergeSettings(base, chosen, forgotten)).toEqual({
      values: null,
      theme: { appearance: "light", accent: "blue", highlight: null },
    });
  });

  it("keeps the apps two windows opened at once in Recent Items, newest first", () => {
    const recent = (ids: string[]) => ({
      values: { "desktop.recentApps": ids, "dock.size": 1 },
      theme: null,
    });
    const base = recent(["notes", "mail"]);
    // Window B opened Calculator and saved first; window A opened Font Book meanwhile.
    const theirs = recent(["calculator", "notes", "mail"]);
    expect(mergeSettings(base, recent(["font-book", "notes", "mail"]), theirs)).toEqual(
      recent(["font-book", "calculator", "notes", "mail"]),
    );
    // Both opened the same app: it is listed once.
    expect(mergeSettings(base, theirs, theirs)).toEqual(theirs);
    // A window brought an app it had opened before to the front; the other opened a new one.
    expect(mergeSettings(base, recent(["mail", "notes"]), theirs)).toEqual(
      recent(["mail", "calculator", "notes"]),
    );
    // Clear Menu in one window, an app opened in the other: only that app.
    expect(mergeSettings(base, recent([]), theirs)).toEqual(recent(["calculator"]));
    expect(mergeSettings(base, theirs, recent([]))).toEqual(recent(["calculator"]));
    // Cleared and then an app opened in one window, Recent Items unchanged in the other (whose
    // save only changed another setting): the cleared history does not come back.
    expect(mergeSettings(base, base, recent(["calculator"]))).toEqual(recent(["calculator"]));
    const sizeChanged = {
      values: { "desktop.recentApps": ["notes", "mail"], "dock.size": 2 },
      theme: null,
    };
    expect(mergeSettings(base, sizeChanged, recent(["calculator"]))).toEqual({
      values: { "desktop.recentApps": ["calculator"], "dock.size": 2 },
      theme: null,
    });
    // Cleared then reopened in one window while the other opened another app: both opens, no history.
    expect(
      mergeSettings(base, recent(["font-book", "notes", "mail"]), recent(["calculator"])),
    ).toEqual(recent(["font-book", "calculator"]));
    // At most the 50 Recent Items keeps.
    const many = Array.from({ length: 50 }, (_, n) => `app-${n}`);
    const merged = mergeSettings(
      recent(many),
      recent(["one", ...many.slice(0, 49)]),
      recent(["two", ...many.slice(0, 49)]),
    ) as { values: Record<string, string[]> };
    expect(merged.values["desktop.recentApps"]).toEqual(["one", "two", ...many.slice(0, 48)]);
    // Forgotten elsewhere (Storage Management): the list goes, as every other setting does.
    expect(
      mergeSettings(base, recent(["font-book", "notes", "mail"]), { values: null, theme: null }),
    ).toEqual({
      values: { "desktop.recentApps": ["font-book", "notes", "mail"] },
      theme: null,
    });
  });
});
