import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { LAUNCHPAD_APP_DRAG } from "../desktop/desktop-launchpad-folders";
import type { CatalogueApp } from "../desktop/desktop-library";
import { forgetDesktopValues } from "../desktop/desktop-personal";
import { AppStore } from "./app-store";
import { storeAppsOf, storiesOfApps } from "./app-store-catalogue";

const app = (id: string, name: string, preinstalled = false): CatalogueApp => ({
  id,
  name,
  category: "media",
  summary: `${name} summary`,
  preinstalled,
});
const CATALOGUE = [app("tv", "TV", true), app("books", "Books"), app("news", "News")];

afterEach(() => {
  forgetDesktopValues();
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

describe("an app of the served store dragged out", () => {
  const dragged = () => {
    const types = new Map<string, string>();
    return {
      types,
      dataTransfer: {
        setData: (type: string, value: string) => types.set(type, value),
        effectAllowed: "",
      },
    };
  };

  it("is its link, and when it is installed the Dock can keep it too", async () => {
    vi.stubEnv("VITE_MACALICIOUS_API", "1");
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: string) =>
        url === "/api/apps"
          ? { ok: true, json: async () => ({ apps: [], catalogue: CATALOGUE }) }
          : { ok: true, json: async () => ({ installed: ["news"], rev: 1 }) },
      ),
    );
    render(<AppStore />);
    const row = async (title: string) => {
      const name = await screen.findByRole("button", { name: `${title}, app page` });
      return name.closest("[draggable='true']") as HTMLElement;
    };
    await waitFor(() =>
      expect(screen.getByRole("button", { name: /^Open, News/ })).toBeInTheDocument(),
    );
    const installed = dragged();
    fireEvent.dragStart(await row("News"), { dataTransfer: installed.dataTransfer });
    expect(installed.types.get(LAUNCHPAD_APP_DRAG)).toBe("news");
    expect(installed.types.get("text/plain")).toContain("#app-store/news");
    const offered = dragged();
    fireEvent.dragStart(await row("Books"), { dataTransfer: offered.dataTransfer });
    expect(offered.types.has(LAUNCHPAD_APP_DRAG)).toBe(false);
    expect(offered.types.get("text/plain")).toContain("#app-store/books");
  });
});

describe("the stories of the served store", () => {
  it("tells of two apps from the catalogue, those not yet got first", () => {
    const apps = storeAppsOf(CATALOGUE, []);
    const stories = storiesOfApps(apps, (each) => each.offer === "Open");
    expect(stories.map(({ title, body, eyebrow }) => [title, body, eyebrow])).toEqual([
      ["Books", "Books summary", "Entertainment"],
      ["News", "News summary", "Entertainment"],
    ]);
  });

  it("shows them at the top of a section, and a story opens its app's page", async () => {
    vi.stubEnv("VITE_MACALICIOUS_API", "1");
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: string) =>
        url === "/api/apps"
          ? { ok: true, json: async () => ({ apps: [], catalogue: CATALOGUE }) }
          : { ok: true, json: async () => ({ installed: null, rev: 0 }) },
      ),
    );
    const user = userEvent.setup();
    render(<AppStore />);
    const card = await waitFor(() =>
      within(screen.getByLabelText("Stories")).getByRole("button", { name: /Books/ }),
    );
    await waitFor(() =>
      expect(document.querySelector(".mac-app-store-page")).not.toHaveAttribute("inert"),
    );
    await user.click(card);
    expect(await screen.findByRole("heading", { name: "Books" })).toBeInTheDocument();
  });
});
