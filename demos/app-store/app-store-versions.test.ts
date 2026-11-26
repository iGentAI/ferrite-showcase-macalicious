import { describe, expect, it } from "vitest";
import { storeAppsOf } from "./app-store-catalogue";
import { appsBehind, settled, versionsFromServer, withCurrent } from "./app-store-versions";

const BOOKS = {
  id: "books",
  name: "Books",
  category: "media",
  summary: "Read",
  preinstalled: false,
};

describe("the versions the store keeps", () => {
  it("reads a reply, before and after the person kept any", () => {
    expect(versionsFromServer({ current: "abc", kept: null, rev: 0 })).toEqual({
      current: "abc",
      kept: {},
    });
    expect(versionsFromServer({ current: "abc", kept: { books: "old" }, rev: 1 })).toEqual({
      current: "abc",
      kept: { books: "old" },
    });
    expect(versionsFromServer({ installed: [], rev: 0 })).toBeUndefined();
    expect(versionsFromServer({ current: "abc", kept: { books: 1 } })).toBeUndefined();
  });

  it("counts an app as behind only when it kept another version", () => {
    const versions = { current: "new", kept: { books: "old", chess: "new" } };
    expect(appsBehind(versions, ["books", "chess", "stocks"])).toEqual(["books"]);
    expect(appsBehind({ current: "", kept: { books: "old" } }, ["books"])).toEqual([]);
  });

  it("takes an app seen for the first time at the current version, and leaves one behind", () => {
    const versions = { current: "new", kept: { books: "old" } };
    expect(settled(versions, ["books", "chess"], false)).toEqual({
      current: "new",
      kept: { books: "old", chess: "new" },
    });
  });

  it("with Automatic Updates on, takes every new version by itself", () => {
    expect(settled({ current: "new", kept: { books: "old" } }, ["books"], true).kept).toEqual({
      books: "new",
    });
  });

  it("changes nothing when nothing is to change", () => {
    const versions = { current: "new", kept: { books: "new" } };
    expect(withCurrent(versions, ["books"])).toBe(versions);
    expect(settled(versions, ["books"], false)).toBe(versions);
  });
});

describe("the store's offers", () => {
  it("offers Update for an app behind, Open otherwise", () => {
    expect(storeAppsOf([BOOKS], ["books"], ["books"])[0]?.offer).toBe("Update");
    expect(storeAppsOf([BOOKS], ["books"])[0]?.offer).toBe("Open");
    expect(storeAppsOf([BOOKS], [])[0]?.offer).toBe("Get");
  });
});
