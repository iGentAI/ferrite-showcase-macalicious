import { describe, expect, it } from "vitest";
import { withFavoriteMoved } from "./finder-saved";
import {
  DEFAULT_TOOLBAR,
  readToolbarItems,
  readToolbarMode,
  withDropped,
  withItem,
  withItemMoved,
  withoutItemAt,
} from "./finder-toolbar-customize";

describe("Finder's toolbar as the person arranges it", () => {
  it("puts a folder of the sidebar where the one it is dragged to stands", () => {
    expect(withFavoriteMoved(["a", "b", "c"], "a", "c")).toEqual(["b", "c", "a"]);
    expect(withFavoriteMoved(["a", "b", "c"], "c", "a")).toEqual(["c", "a", "b"]);
    const same = ["a", "b"];
    expect(withFavoriteMoved(same, "a", "a")).toBe(same);
    expect(withFavoriteMoved(same, "gone", "a")).toBe(same);
  });
  it("reads what it knows, each once but for the spaces", () => {
    expect(readToolbarItems(["back", "back", "nothing", "space", "space", "search"])).toEqual([
      "back",
      "space",
      "space",
      "search",
    ]);
    expect(readToolbarItems("back")).toBeUndefined();
    expect(readToolbarMode("label-only")).toBe("label-only");
    expect(readToolbarMode("huge")).toBeUndefined();
  });

  it("adds an item ahead of the space and search that close the toolbar, and only once", () => {
    expect(withItem(DEFAULT_TOOLBAR, "delete").slice(-3)).toEqual(["delete", "flexible", "search"]);
    expect(withItem(DEFAULT_TOOLBAR, "back")).toBe(DEFAULT_TOOLBAR);
    expect(withItem(["space"], "space")).toEqual(["space", "space"]);
  });

  it("keeps the row's order when a drag names an item already in it, and adds what it does not hold", () => {
    expect(withDropped(["back", "views"], "delete", 1)).toEqual(["back", "delete", "views"]);
    expect(withDropped(["back", "views"], "views", 0)).toEqual(["back", "views"]);
    expect(withDropped(["back", "views"], "0", 1)).toEqual(["views", "back"]);
    expect(withDropped(["space"], "space", 0)).toEqual(["space", "space"]);
    expect(withDropped(["back"], "nothing", 0)).toEqual(["back"]);
  });

  it("moves and takes out by place", () => {
    expect(withItemMoved(["back", "views", "group"], 0, 2)).toEqual(["views", "group", "back"]);
    expect(withItemMoved(["back", "views", "group"], 2, 0)).toEqual(["group", "back", "views"]);
    expect(withoutItemAt(["space", "back", "space"], 2)).toEqual(["space", "back"]);
  });
});
