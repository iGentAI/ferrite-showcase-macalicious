import type { ManagedWindowInfo } from "macalicious/window-manager";
import { describe, expect, it } from "vitest";
import type { DesktopApp } from "./desktop-apps";
import { appsByRecentUse } from "./desktop-overview";

const app = (id: string) => ({ id, name: id }) as DesktopApp;
const opened = (...apps: string[]) => apps.map((id) => ({ app: id })) as ManagedWindowInfo[];

describe("the switcher's order", () => {
  const apps = ["finder", "notes", "mail", "chess"].map(app);

  it("goes from the application used last, once each, with Finder always there", () => {
    expect(appsByRecentUse(opened("notes", "mail", "notes"), apps).map(({ id }) => id)).toEqual([
      "notes",
      "mail",
      "finder",
    ]);
    expect(appsByRecentUse([], apps).map(({ id }) => id)).toEqual(["finder"]);
  });

  it("leaves out a window of an application the desktop does not list", () => {
    expect(appsByRecentUse(opened("gone", "chess"), apps).map(({ id }) => id)).toEqual([
      "chess",
      "finder",
    ]);
  });
});
