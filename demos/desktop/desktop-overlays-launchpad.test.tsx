import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { DesktopApp } from "./desktop-apps";
import { DesktopOverlays } from "./desktop-overlays";

// In a file of its own: the page reads the catalogue once, so this test's catalogue must be the
// first any test of the file serves.

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

const app = (id: string, name: string) =>
  ({
    id,
    name,
    component: () => null,
    defaultSize: { width: 100, height: 100 },
    menus: [],
  }) satisfies DesktopApp;

describe("Launchpad's delete badge on the desktop", () => {
  it("asks before it deletes an app got from the store, with Launchpad still open", async () => {
    vi.stubEnv("VITE_MACALICIOUS_API", "1");
    const catalogue = [
      { id: "books", name: "Books", category: "media", summary: "", preinstalled: false },
      { id: "notes", name: "Notes", category: "productivity", summary: "", preinstalled: true },
    ];
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: string) =>
        url === "/api/apps"
          ? { ok: true, json: async () => ({ apps: [], catalogue }) }
          : { ok: true, json: async () => ({ installed: ["books"], rev: 1 }) },
      ),
    );
    const onOverlayChange = vi.fn();
    const launch = vi.fn();
    const apps = [app("books", "Books"), app("notes", "Notes")];
    render(
      <DesktopOverlays
        overlay="launchpad"
        onOverlayChange={onOverlayChange}
        apps={apps}
        launch={launch}
        container={document.body}
      />,
    );
    const user = userEvent.setup();
    await screen.findByRole("button", { name: "Books" });
    // Option held down, as the pointer presses the badge.
    await user.keyboard("{Alt>}");
    const badge = await screen.findByRole("button", { name: "Delete Books" });
    expect(screen.queryByRole("button", { name: "Delete Notes" })).toBeNull();
    await user.click(badge);
    expect(await screen.findByRole("alertdialog")).toHaveTextContent("Delete “Books”?");
    expect(launch).not.toHaveBeenCalled();
    expect(onOverlayChange).not.toHaveBeenCalledWith(null);
  });
});
