import { act, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { takeOpenUrlRequests } from "../desktop/desktop-open-url";
import { beginDesktopValues, forgetDesktopValues } from "../desktop/desktop-personal";
import { News } from "./news";
import { NEWS_URLS } from "./news-live";
import { NewsTodayWidget } from "./news-widget";

afterEach(() => {
  forgetDesktopValues();
  beginDesktopValues();
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

const NOW = Date.now();

const catalogue = {
  channels: [
    { id: "bbc", name: "BBC News", tint: "#bb1919", site: "https://www.bbc.co.uk/news" },
    { id: "npr", name: "NPR", tint: "#237bbd", site: "https://www.npr.org/" },
    { id: "guardian", name: "The Guardian", tint: "#052962", site: "https://www.theguardian.com/" },
    { id: "ars", name: "Ars Technica", tint: "#ff4e00", site: "https://arstechnica.com/" },
    { id: "nasa", name: "NASA", tint: "#0b3d91", site: "https://www.nasa.gov/" },
  ],
  topics: [{ id: "science", name: "Science", tint: "#5f7fa6", sources: ["nasa"] }],
  following: ["bbc", "npr", "guardian", "ars"],
  freshMs: 900_000,
};

const feed = (id: string, publisher: string, minutes: number[]) => ({
  source: { id, publisher, site: "https://example.com/" },
  fetched: NOW,
  stale: false,
  stories: minutes.map((ago, n) => ({
    id: `${id}${n}`,
    title: `${publisher} story ${n + 1}`,
    link: `https://example.com/${id}/${n}`,
    summary: `First paragraph of ${id} ${n}.\n\nSecond paragraph.`,
    published: NOW - ago * 60_000,
  })),
});

function serve(overrides: Record<string, unknown> = {}) {
  vi.stubEnv("VITE_MACALICIOUS_API", "1");
  const replies: Record<string, unknown> = {
    [NEWS_URLS.catalogue]: catalogue,
    [NEWS_URLS.library]: { library: null, rev: 0 },
    [NEWS_URLS.source("bbc")]: feed("bbc", "BBC News", [5, 50]),
    [NEWS_URLS.source("npr")]: feed("npr", "NPR", [10, 70]),
    [NEWS_URLS.source("guardian")]: feed("guardian", "The Guardian", [20]),
    [NEWS_URLS.source("ars")]: feed("ars", "Ars Technica", [30]),
    [NEWS_URLS.source("nasa")]: feed("nasa", "NASA", [40]),
    ...overrides,
  };
  let rev = 0;
  const fetch = vi.fn(async (url: string, init?: RequestInit) => {
    if (init?.method === "PUT") {
      rev += 1;
      const body = JSON.parse(String(init.body));
      // Kept as a server keeps it: the next read, or the next window, is answered with it.
      replies[url] = { ...body, rev };
      return { ok: true, status: 200, json: async () => ({ ...body, rev }) };
    }
    const answer = replies[url];
    // A function answers each request afresh (a reply that changes between tries, or one held
    // back until the test lets it go).
    const reply = typeof answer === "function" ? await answer() : answer;
    if (reply instanceof Error) {
      return { ok: false, status: 502, json: async () => ({ error: reply.message }) };
    }
    return { ok: reply !== undefined, status: reply ? 200 : 404, json: async () => reply };
  });
  vi.stubGlobal("fetch", fetch);
  return fetch;
}

const saves = (fetch: ReturnType<typeof serve>) =>
  fetch.mock.calls
    .filter(([, init]) => init?.method === "PUT")
    .map(([, init]) => JSON.parse(String(init?.body)).library);

describe("News on the desktop's Ferrite application", () => {
  it("reopens a saved story with its summary after its feed has moved on", async () => {
    const user = userEvent.setup();
    serve({
      [NEWS_URLS.library]: {
        library: {
          following: ["bbc"],
          blocked: [],
          saved: [
            {
              id: "gone1",
              source: "bbc",
              publisher: "BBC News",
              title: "A story the feed no longer lists",
              link: "https://example.com/bbc/gone",
              published: NOW - 86_400_000,
              summary: "What the story was about, kept with it.",
            },
          ],
          history: [],
        },
        rev: 2,
      },
    });
    render(<News />);
    await user.click(await screen.findByRole("button", { name: "Saved Stories" }));
    await user.click(
      await screen.findByRole("button", { name: "A story the feed no longer lists" }),
    );
    expect(await screen.findByText("What the story was about, kept with it.")).toBeInTheDocument();
  });

  it("tries the channel list again by itself, then offers Try Again", async () => {
    const user = userEvent.setup();
    let catalogueTries = 0;
    let available = false;
    serve({
      [NEWS_URLS.catalogue]: () => {
        catalogueTries += 1;
        return available ? catalogue : new Error("down");
      },
    });
    // A fresh module: the page reads the catalogue once and keeps it.
    vi.resetModules();
    const { News: FreshNews } = await import("./news");
    render(<FreshNews />);
    expect(
      await screen.findByText("News Is Not Available", undefined, { timeout: 10_000 }),
    ).toBeInTheDocument();
    expect(catalogueTries).toBe(3);
    available = true;
    await user.click(screen.getByRole("button", { name: "Try Again" }));
    expect(
      await screen.findByRole("button", { name: "BBC News story 1" }, { timeout: 10_000 }),
    ).toBeInTheDocument();
    expect(screen.queryByText("News Is Not Available")).toBeNull();
    expect(screen.queryByRole("button", { name: "Try Again" })).toBeNull();
  }, 30_000);

  it("stays busy until the channel list has arrived too, so its sidebar is whole once it is not", async () => {
    let answerCatalogue = () => {};
    const held = new Promise<void>((resolve) => {
      answerCatalogue = resolve;
    });
    const fetch = serve({
      [NEWS_URLS.library]: {
        library: { following: ["bbc", "nasa"], blocked: ["ars"], saved: [], history: [] },
        rev: 3,
      },
      [NEWS_URLS.catalogue]: async () => {
        await held;
        return catalogue;
      },
    });
    // A fresh module: the page reads the catalogue once and keeps it. The desktop has made
    // requests before News opens, so the page's session is set and News's requests run at once.
    vi.resetModules();
    const { sessionFetch } = await import("../desktop/desktop-server");
    await sessionFetch("/api/session");
    const { News: FreshNews } = await import("./news");
    render(<FreshNews />);
    const window = screen.getByRole("region", { name: "News" });
    await waitFor(() =>
      expect(fetch).toHaveBeenCalledWith(
        expect.stringContaining(NEWS_URLS.library),
        expect.anything(),
      ),
    );
    // The library has loaded; the channel list has not: the window is still busy, not inert.
    await act(async () => {});
    expect(window).toHaveAttribute("aria-busy", "true");
    expect(window).not.toHaveAttribute("inert");
    answerCatalogue();
    await waitFor(() => expect(window).not.toHaveAttribute("aria-busy"));
    const sidebar = within(window).getByRole("navigation", { name: "Channels" });
    expect(within(sidebar).getByRole("button", { name: /BBC News/ })).toBeInTheDocument();
    expect(within(sidebar).getByRole("button", { name: /NASA/ })).toBeInTheDocument();
    expect(within(sidebar).queryByRole("button", { name: /Ars Technica/ })).toBeNull();
  });

  it("asks no server when the page is not served by the application", () => {
    const fetch = vi.fn();
    vi.stubGlobal("fetch", fetch);
    render(<News />);
    expect(fetch).not.toHaveBeenCalled();
    expect(screen.getByText("October 3")).toBeInTheDocument();
  });

  it("leads Today with the newest stories of the channels followed", async () => {
    const fetch = serve();
    render(<News />);
    await screen.findByRole("button", { name: "Ars Technica story 1" });
    const top = screen.getByRole("region", { name: "Top Stories" });
    const more = screen.getByRole("region", { name: "More of the top stories" });
    await waitFor(() =>
      expect(
        [top, more].flatMap((grid) =>
          within(grid)
            .getAllByRole("heading", { level: 4 })
            .map((heading) => heading.textContent),
        ),
      ).toEqual([
        "BBC News story 1",
        "NPR story 1",
        "The Guardian story 1",
        "Ars Technica story 1",
        "BBC News story 2",
      ]),
    );
    expect(screen.getByText("5m ago")).toBeInTheDocument();
    const asked = fetch.mock.calls.map(([url]) => url);
    expect(asked).toEqual(
      expect.arrayContaining([
        NEWS_URLS.source("bbc"),
        NEWS_URLS.source("npr"),
        NEWS_URLS.source("guardian"),
        NEWS_URLS.source("ars"),
      ]),
    );
    const sidebar = screen.getByRole("navigation", { name: "Channels" });
    expect(within(sidebar).getByText("The Guardian")).toBeInTheDocument();
  });

  it("suggests stories of a channel not followed, and none of a blocked one", async () => {
    serve();
    const { unmount } = render(<News />);
    const suggested = await screen.findByRole("region", { name: "Suggested For You" });
    await within(suggested).findByRole("button", { name: "NASA story 1" });
    expect(within(suggested).queryByRole("button", { name: "BBC News story 1" })).toBeNull();
    unmount();

    serve({
      [NEWS_URLS.library]: {
        library: {
          following: ["bbc", "npr", "guardian", "ars"],
          blocked: ["nasa"],
          saved: [],
          history: [],
        },
        rev: 1,
      },
    });
    render(<News />);
    await screen.findByRole("button", { name: "BBC News story 1" });
    expect(screen.queryByText("Suggested For You")).toBeNull();
  });

  it("finds in the open story, moving between the places, and closes", async () => {
    const user = userEvent.setup();
    // jsdom has no layout to scroll.
    Element.prototype.scrollIntoView = vi.fn();
    serve();
    render(<News />);
    await user.click(await screen.findByRole("button", { name: "BBC News story 1" }));
    await screen.findByRole("heading", { level: 2, name: "BBC News story 1" });
    fireEvent.keyDown(window, { key: "f", code: "KeyF", ctrlKey: true, altKey: true });
    const field = await screen.findByRole("searchbox", { name: "Find in Story" });
    await waitFor(() => expect(field).toHaveFocus());
    await user.keyboard("paragraph");
    expect(await screen.findByText("1 of 2")).toBeInTheDocument();
    await user.keyboard("{Enter}");
    expect(await screen.findByText("2 of 2")).toBeInTheDocument();
    const current = document.querySelector("[data-current]");
    expect(current?.textContent).toBe("paragraph");
    expect(current?.parentElement?.textContent).toBe("Second paragraph.");
    await user.keyboard("{Enter}");
    expect(await screen.findByText("1 of 2")).toBeInTheDocument();
    await user.clear(field);
    await user.keyboard("nothing like it");
    expect(await screen.findByText("Not Found")).toBeInTheDocument();
    await user.keyboard("{Escape}");
    expect(screen.queryByRole("searchbox", { name: "Find in Story" })).toBeNull();
  });

  it("opens a story with its summary, records it in History and opens the full story", async () => {
    const user = userEvent.setup();
    const fetch = serve();
    const open = vi.fn();
    vi.stubGlobal("open", open);
    takeOpenUrlRequests();
    const view = render(<News />);
    await user.click(await screen.findByRole("button", { name: "NPR story 1" }));
    expect(await screen.findByRole("heading", { level: 2, name: "NPR story 1" })).toHaveFocus();
    expect(screen.getByText("First paragraph of npr 0.")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Read Full Story" }));
    // No Safari window is open here: the link is kept for Safari, which is opened to take it.
    expect(takeOpenUrlRequests()).toEqual([{ url: "https://example.com/npr/0", from: "news" }]);
    expect(open).not.toHaveBeenCalled();
    expect(screen.getByText("Opened at NPR in Safari.")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Save Story" }));
    await waitFor(() => {
      const last = saves(fetch).at(-1);
      expect(last?.history.map((story: { id: string }) => story.id)).toEqual(["npr0"]);
      expect(last?.saved.map((story: { title: string }) => story.title)).toEqual(["NPR story 1"]);
    });
    // What the server was given is what a window opened again shows.
    view.unmount();
    render(<News />);
    await user.click(await screen.findByRole("button", { name: "Saved Stories" }));
    expect(await screen.findByRole("button", { name: "NPR story 1" })).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "History" }));
    expect(await screen.findByRole("button", { name: "NPR story 1" })).toBeInTheDocument();
  });

  it("follows and blocks channels from Discover", async () => {
    const user = userEvent.setup();
    const fetch = serve();
    const view = render(<News />);
    await user.click(await screen.findByRole("button", { name: "Discover Channels" }));
    await user.click(screen.getByRole("button", { name: "Follow NASA" }));
    await user.click(screen.getByRole("button", { name: "Block BBC News" }));
    await waitFor(() => {
      const last = saves(fetch).at(-1);
      expect(last?.following).toEqual(["npr", "guardian", "ars", "nasa"]);
      expect(last?.blocked).toEqual(["bbc"]);
    });
    await user.click(screen.getByRole("button", { name: "Today" }));
    expect(await screen.findByRole("button", { name: "NASA story 1" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "BBC News story 1" })).toBeNull();
    view.unmount();
    render(<News />);
    expect(await screen.findByRole("button", { name: "NASA story 1" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "BBC News story 1" })).toBeNull();
  });

  it("says when a feed could not be read", async () => {
    serve({ [NEWS_URLS.source("nasa")]: new Error("NASA could not be read: timeout") });
    const user = userEvent.setup();
    render(<News />);
    await user.click(await screen.findByRole("button", { name: "Science" }));
    expect(await screen.findByText(/Could not refresh NASA/)).toBeInTheDocument();
    expect(screen.getByText("No Stories")).toBeInTheDocument();
  });

  it("lists the newest headlines of the channels followed in the Today widget", async () => {
    const user = userEvent.setup();
    serve({
      [NEWS_URLS.library]: {
        library: { following: ["nasa", "npr"], blocked: ["npr"], saved: [], history: [] },
        rev: 3,
      },
    });
    const open = vi.fn();
    vi.stubGlobal("open", open);
    takeOpenUrlRequests();
    render(<NewsTodayWidget />);
    const widget = screen.getByRole("region", { name: "News" });
    const story = await within(widget).findByRole("button", { name: /NASA story 1/ });
    expect(within(widget).queryByText(/NPR story/)).toBeNull();
    await user.click(story);
    // The story is handed to Safari (`openUrl`), never opened in a bare browser tab.
    expect(takeOpenUrlRequests()).toEqual([{ url: "https://example.com/nasa/0", from: "news" }]);
    expect(open).not.toHaveBeenCalled();
  });

  it("reads every channel followed for the Today widget, not only the first few", async () => {
    serve({
      [NEWS_URLS.library]: {
        library: {
          following: ["bbc", "npr", "guardian", "nasa", "ars"],
          blocked: [],
          saved: [],
          history: [],
        },
        rev: 1,
      },
      [NEWS_URLS.source("ars")]: feed("ars", "Ars Technica", [1]),
    });
    render(<NewsTodayWidget />);
    const widget = screen.getByRole("region", { name: "News" });
    expect(
      await within(widget).findByRole("button", { name: /Ars Technica story 1/ }),
    ).toBeInTheDocument();
  });

  it("shows no default channels in the widget when the library cannot be read", async () => {
    const fetch = serve({ [NEWS_URLS.library]: new Error("storage failed") });
    render(<NewsTodayWidget />);
    const widget = screen.getByRole("region", { name: "News" });
    expect(await within(widget).findByText("News is not available.")).toBeInTheDocument();
    const asked = fetch.mock.calls.map(([url]) => url);
    expect(asked.filter((url) => url.startsWith("/api/news/sources/"))).toEqual([]);
  });
});
