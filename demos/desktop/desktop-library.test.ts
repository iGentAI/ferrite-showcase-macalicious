import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { discoveredApps } from "./desktop-apps";
import { catalogueFromServer, installedFromServer, layoutFromServer } from "./desktop-library";

// The server's catalogue (ferrite-apps/desktop/src/apps/catalogue.rs) names the apps the
// desktop hosts: a demo missing from it would never be sold or ordered, an id it has and the
// desktop does not would be sold and never open. The demos the Ferrite desktop does not deploy
// (ferrite-apps/desktop/not-deployed.json) are left out of its build and of the catalogue.
describe("the server's catalogue", () => {
  it("lists every demo the Ferrite desktop hosts but Finder, and nothing else", () => {
    const source = readFileSync(
      path.resolve(__dirname, "../../ferrite-apps/desktop/src/apps/catalogue.rs"),
      "utf8",
    );
    const notDeployed = (
      JSON.parse(
        readFileSync(
          path.resolve(__dirname, "../../ferrite-apps/desktop/not-deployed.json"),
          "utf8",
        ),
      ) as { apps: { id: string }[] }
    ).apps.map((app) => app.id);
    const listed = [...source.matchAll(/app\(\s*"([a-z0-9-]+)",\s*"([^"]+)"/g)].map((match) => ({
      id: match[1],
      name: match[2],
    }));
    const hosted = discoveredApps
      .filter((app) => app.id !== "finder" && !notDeployed.includes(app.id))
      .map((app) => ({ id: app.id, name: app.name }));
    const byId = (a: { id?: string }, b: { id?: string }) => (a.id ?? "").localeCompare(b.id ?? "");
    expect(listed.sort(byId)).toEqual(hosted.sort(byId));
    // Each app left out is a demo the library still hosts.
    expect(notDeployed.every((id) => discoveredApps.some((app) => app.id === id))).toBe(true);
  });
});

describe("replies the desktop reads", () => {
  it("reads a catalogue only when every entry is whole", () => {
    const app = {
      id: "books",
      name: "Books",
      category: "media",
      summary: "s",
      preinstalled: false,
    };
    expect(catalogueFromServer({ apps: [], catalogue: [app] })).toEqual([app]);
    expect(catalogueFromServer({ apps: [] })).toBeUndefined();
    expect(catalogueFromServer({ catalogue: [{ ...app, preinstalled: "no" }] })).toBeUndefined();
  });

  it("reads the apps got, with null as none", () => {
    expect(installedFromServer({ installed: null, rev: 0 })).toEqual([]);
    expect(installedFromServer({ installed: ["books"], rev: 1 })).toEqual(["books"]);
    expect(installedFromServer({ installed: "books" })).toBeUndefined();
  });

  it("reads Launchpad's layout, with null as the first page in the Dock's order", () => {
    expect(layoutFromServer({ order: null, page: null, rev: 0 })).toEqual({ order: [], page: 0 });
    expect(layoutFromServer({ order: ["notes"], page: 1 })).toEqual({ order: ["notes"], page: 1 });
    expect(layoutFromServer({ order: ["notes"], page: -1 })).toBeUndefined();
    expect(layoutFromServer({ order: ["notes"], page: null })).toBeUndefined();
  });
});
