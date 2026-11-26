import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { beginDesktopValues, forgetDesktopValues } from "../desktop/desktop-personal";
import { News } from "./news";
import { channelOfAddress, NEWS_URLS } from "./news-live";

/* `fetch` answers as the desktop's News module does: its catalogue, an empty library and empty feeds. */

const channels = [
  { id: "bbc", name: "BBC News", tint: "#bb1919", site: "https://www.bbc.co.uk/news" },
  { id: "npr", name: "NPR", tint: "#237bbd", site: "https://www.npr.org/" },
];
const catalogue = {
  channels,
  topics: [{ id: "science", name: "Science", tint: "#5f7fa6", sources: ["npr"] }],
  following: ["bbc"],
  freshMs: 900_000,
};

function serve() {
  vi.stubEnv("VITE_MACALICIOUS_API", "1");
  const fetch = vi.fn(async (url: string) => {
    if (url === NEWS_URLS.catalogue) return { ok: true, status: 200, json: async () => catalogue };
    if (url === NEWS_URLS.library) {
      return { ok: true, status: 200, json: async () => ({ library: null, rev: 0 }) };
    }
    const source = url.split("/").pop() ?? "";
    return {
      ok: true,
      status: 200,
      json: async () => ({
        source: { id: source, publisher: source, site: "https://example.com/" },
        fetched: Date.now(),
        stale: false,
        stories: [],
      }),
    };
  });
  vi.stubGlobal("fetch", fetch);
}

afterEach(() => {
  forgetDesktopValues();
  beginDesktopValues();
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

describe("the channel of a web address", () => {
  it.each([
    ["https://www.npr.org/2026/10/story", "npr"],
    ["https://text.npr.org/x", "npr"],
    ["npr.org", "npr"],
    ["https://www.bbc.co.uk/sport", "bbc"],
    ["https://notnpr.org/", undefined],
    ["https://example.com/", undefined],
    ["not an address", undefined],
  ])("%s is %s", (address, id) => {
    expect(channelOfAddress(address, channels)?.id).toBe(id);
  });
});

describe("a web address dropped on News", () => {
  const drop = (address: string) => {
    const pane = document.querySelector(".mac-news-pane") as Element;
    fireEvent.drop(pane, {
      dataTransfer: { types: ["text/uri-list"], getData: () => address },
    });
  };

  it("opens the channel that publishes it, and says when none does", async () => {
    serve();
    render(<News />);
    await screen.findByRole("button", { name: "Discover Channels" });
    drop("https://www.example.org/story");
    expect(
      await screen.findByText("No channel here publishes from https://www.example.org/story."),
    ).toBeInTheDocument();
    drop("https://www.npr.org/story");
    expect(await screen.findByRole("heading", { name: "NPR" })).toBeInTheDocument();
  });
});

describe("Unfollow Topic", () => {
  it("takes the topic out of the sidebar, and Discover follows it again", async () => {
    const user = userEvent.setup({ pointerEventsCheck: 0 });
    serve();
    render(<News />);
    const row = await screen.findByRole("button", { name: "Science" });
    fireEvent.contextMenu(row);
    expect(await screen.findByRole("menuitem", { name: "Block Topic" })).toHaveAttribute(
      "aria-disabled",
      "true",
    );
    await user.click(await screen.findByRole("menuitem", { name: "Unfollow Topic" }));
    await waitFor(() => expect(screen.queryByRole("button", { name: "Science" })).toBeNull());

    await user.click(screen.getByRole("button", { name: "Discover Channels" }));
    const topics = await screen.findByRole("list", { name: "Topics" });
    await user.click(within(topics).getByRole("button", { name: "Follow Science" }));
    expect(within(topics).getByRole("button", { name: "Unfollow Science" })).toBeInTheDocument();
    expect(
      within(screen.getByRole("navigation", { name: "Channels" })).getByRole("button", {
        name: "Science",
      }),
    ).toBeInTheDocument();
  });
});
