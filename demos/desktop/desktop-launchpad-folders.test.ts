import { describe, expect, it } from "vitest";
import {
  folderNameFor,
  launchpadEntries,
  readFolders,
  withAppInFolder,
  withAppOutOfFolder,
  withFolderNamed,
  withNewFolder,
} from "./desktop-launchpad-folders";

const apps = ["a", "b", "c", "d"].map((id) => ({ id }));
const shape = (entries: ReturnType<typeof launchpadEntries<{ id: string }>>) =>
  entries.map((each) =>
    each.kind === "app" ? each.app.id : `[${each.apps.map(({ id }) => id).join("")}]`,
  );

describe("Launchpad's folders", () => {
  it("stands a folder where its first application stands, and hides the others", () => {
    const folders = [{ id: "f", name: "F", apps: ["c", "a"] }];
    expect(shape(launchpadEntries(apps, folders))).toEqual(["b", "[ca]", "d"]);
  });

  it("lets a folder stand aside when one application is left of it", () => {
    const folders = [{ id: "f", name: "F", apps: ["gone", "a"] }];
    expect(shape(launchpadEntries(apps, folders))).toEqual(["a", "b", "c", "d"]);
  });

  it("makes a folder of two, taking them from any other, which goes if left with one", () => {
    const made = withNewFolder([{ id: "f", name: "F", apps: ["a", "b"] }], "a", "c", "New");
    expect(made).toEqual([{ id: "folder-1", name: "New", apps: ["c", "a"] }]);
  });

  it("adds to a folder, takes out of one and renames", () => {
    const one = [
      { id: "f", name: "F", apps: ["a", "b"] },
      { id: "g", name: "G", apps: ["c", "d", "e"] },
    ];
    expect(withAppInFolder(one, "e", "f")).toEqual([
      { id: "g", name: "G", apps: ["c", "d"] },
      { id: "f", name: "F", apps: ["a", "b", "e"] },
    ]);
    expect(withAppInFolder(one, "a", "f")).toBe(one);
    expect(withAppOutOfFolder(one, "a")).toEqual([one[1]]);
    expect(withFolderNamed(one, "f", "Work")[0]?.name).toBe("Work");
  });

  it("reads only what is well formed, and names a folder by what its applications share", () => {
    expect(readFolders([{ id: "f", name: "F", apps: ["a"] }, { id: 1 }, null])).toHaveLength(1);
    expect(readFolders("x")).toBeUndefined();
    expect(folderNameFor("games", "games")).toBe("Games");
    expect(folderNameFor("games", "media")).toBe("Untitled");
  });
});
