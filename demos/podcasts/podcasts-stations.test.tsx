import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MenuBar, MenuBarMenu } from "macalicious/menu-bar";
import { afterEach, describe, expect, it, vi } from "vitest";
import { useDesktopAppMenuItems } from "../desktop/desktop-app-menus";
import { beginDesktopValues, forgetDesktopValues } from "../desktop/desktop-personal";
import { requestOpenFile, takeOpenFileRequests } from "../finder/finder-open";
import { podcastsApp } from "./app";
import { DesktopPodcasts, SYNC_NOTE } from "./podcasts-desktop";
import {
  EMPTY_LIBRARY,
  type PodcastsLibraryState,
  podcastsLibraryToServer,
  type QueuedEpisode,
} from "./podcasts-server";
import { readStations, savedStation } from "./podcasts-stations";

/*
 * Test doubles: `fetch` answers as the desktop's Podcasts module does, with no server or feed
 * reached; the drive's `readFile` answers with the OPML below; jsdom has no media pipeline, so
 * `play`, `pause` and `load` on the audio element are stubbed.
 */

const NOW = Date.now();
const FEED_A = "https://feeds.npr.org/1/podcast.xml";
const FEED_B = "https://feeds.npr.org/2/podcast.xml";
const FEED_C = "https://feeds.npr.org/3/podcast.xml";
const OPML = `<?xml version="1.0"?><opml version="1.0"><body><outline type="rss" xmlUrl="${FEED_C}"/></body></opml>`;

vi.mock("../desktop/desktop-files", async (original) => ({
  ...(await original<typeof import("../desktop/desktop-files")>()),
  readFile: async () => new Blob([OPML]),
}));

const show = (id: string, title: string, feed: string) => ({
  id,
  title,
  author: "NPR",
  artwork: null,
  genre: "News",
  feed,
  seen: NOW,
});

const feedOf = (url: string, title: string, episodes: [string, string, number][]) => ({
  url,
  fetched: NOW,
  cut: false,
  title,
  author: "NPR",
  description: "",
  episodes: episodes.map(([id, name, ago]) => ({
    id,
    title: name,
    summary: "",
    published: NOW - ago * 86_400_000,
    audio: { url: `https://media.npr.org/${id}.mp3`, kind: "audio/mpeg" },
    duration: 600,
    link: `https://www.npr.org/${id}`,
  })),
});

const FEEDS: Record<string, unknown> = {
  [FEED_A]: feedOf(FEED_A, "Up First", [["aaaaaaaaaaaaaaaa", "Tuesday", 1]]),
  [FEED_B]: feedOf(FEED_B, "Planet Money", [["bbbbbbbbbbbbbbbb", "Money", 2]]),
  [FEED_C]: feedOf(FEED_C, "Fresh Air", [["cccccccccccccccc", "Interview", 3]]),
};

const TWO_SHOWS = {
  shows: [show("1", "Up First", FEED_A), show("2", "Planet Money", FEED_B)],
  subscribed: ["1", "2"],
};

const TUESDAY: QueuedEpisode = {
  id: "1.aaaaaaaaaaaaaaaa",
  show: "1",
  title: "Tuesday",
  showTitle: "Up First",
  artwork: null,
  audio: "https://media.npr.org/aaaaaaaaaaaaaaaa.mp3",
  kind: "audio/mpeg",
  duration: 600,
  published: NOW - 86_400_000,
  feed: FEED_A,
};

function serve(change: Partial<PodcastsLibraryState> = TWO_SHOWS) {
  vi.stubEnv("VITE_MACALICIOUS_API", "1");
  vi.spyOn(HTMLMediaElement.prototype, "load").mockImplementation(() => {});
  const play = vi.spyOn(HTMLMediaElement.prototype, "play").mockResolvedValue();
  const reply = (body: unknown, status = 200) => ({
    ok: status < 400,
    status,
    json: async () => body,
  });
  let library: unknown = podcastsLibraryToServer({ ...EMPTY_LIBRARY, ...change }).library;
  const fetch = vi.fn(async (url: string, init?: RequestInit) => {
    const { pathname, searchParams } = new URL(url, "http://desktop.test");
    if (pathname === "/api/podcasts/library") {
      if (init?.method === "PUT") library = JSON.parse(String(init.body)).library;
      return reply({ library, rev: 1 });
    }
    if (pathname === "/api/podcasts/feed") {
      return reply({ feed: FEEDS[searchParams.get("url") ?? ""], stale: false, error: null });
    }
    return reply({ error: "not found" }, 404);
  });
  vi.stubGlobal("fetch", fetch);
  return { fetch, play, library: () => library as { shows: { title: string }[] } };
}

afterEach(() => {
  forgetDesktopValues();
  beginDesktopValues();
  takeOpenFileRequests("podcasts");
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

function FileMenu() {
  const items = useDesktopAppMenuItems("podcasts", "File");
  return (
    <MenuBar aria-label="Menus">
      <MenuBarMenu title="File">{items}</MenuBarMenu>
    </MenuBar>
  );
}

const frame = () => screen.getByRole("region", { name: "Podcasts" });
const loaded = () => waitFor(() => expect(frame()).not.toHaveAttribute("aria-busy"));
const places = () => within(screen.getByRole("tree", { name: "Podcasts" }));

describe("Stations", () => {
  it("makes one from followed shows: it lists under Stations, keeps over a reload, and plays", async () => {
    const user = userEvent.setup({ pointerEventsCheck: 0 });
    const { play } = serve();
    const view = render(
      <>
        <FileMenu />
        <DesktopPodcasts />
      </>,
    );
    await loaded();
    await user.click(screen.getByRole("menuitem", { name: "File" }));
    await user.click(await screen.findByRole("menuitem", { name: "New Station…" }));
    const create = await screen.findByRole("button", { name: "Create" });
    expect(create).toBeDisabled();
    await user.type(screen.getByRole("textbox", { name: "Station name" }), "Morning");
    expect(create).toBeDisabled();
    await user.click(screen.getByRole("checkbox", { name: "Up First" }));
    await user.click(create);

    expect(await places().findByRole("treeitem", { name: "Morning" })).toBeInTheDocument();
    expect(await screen.findByText("1 Episode")).toBeInTheDocument();
    expect(await screen.findAllByRole("button", { name: /Tuesday/ })).not.toHaveLength(0);
    expect(screen.queryByRole("button", { name: /Money, / })).toBeNull();

    await user.click(screen.getByRole("button", { name: "Play Station" }));
    await waitFor(() => expect(play).toHaveBeenCalled());
    expect(screen.getByRole("group", { name: "Now Playing" })).toHaveTextContent("Tuesday");

    view.unmount();
    render(<DesktopPodcasts />);
    await loaded();
    expect(places().getByRole("treeitem", { name: "Morning" })).toBeInTheDocument();
    fireEvent.contextMenu(places().getByRole("treeitem", { name: "Morning" }));
    await user.click(await screen.findByRole("menuitem", { name: "Delete Station" }));
    await waitFor(() => expect(places().queryByRole("treeitem", { name: "Morning" })).toBeNull());
  });

  it("reads back only what is a station, and saves one in place", () => {
    expect(readStations("no")).toBeUndefined();
    expect(readStations([{ id: "a", name: "A", shows: ["1"] }, { id: "b" }, null])).toEqual([
      { id: "a", name: "A", shows: ["1"] },
    ]);
    const one = { id: "a", name: "A", shows: ["1"] };
    expect(savedStation([one], { ...one, name: "B" })).toEqual([{ ...one, name: "B" }]);
    expect(savedStation([one], { id: "c", name: "C", shows: [] })).toHaveLength(2);
  });
});

describe("Preferences", () => {
  it("does not offer Sync as a choice, as the server already keeps the shows, and says so", async () => {
    const user = userEvent.setup({ pointerEventsCheck: 0 });
    serve();
    render(<DesktopPodcasts defaultPreferencesOpen />);
    await loaded();
    await user.click(screen.getByText("Advanced"));
    const sync = await screen.findByRole("checkbox", { name: "Sync subscriptions across devices" });
    expect(sync).toHaveAttribute("aria-disabled", "true");
    expect(sync).toBeChecked();
    expect(screen.getByText(SYNC_NOTE)).toBeInTheDocument();
  });
});

describe("the space bar", () => {
  it("plays the loaded episode, and stays a field's own", async () => {
    const { play } = serve({ ...TWO_SHOWS, current: TUESDAY });
    render(<DesktopPodcasts />);
    await loaded();
    const searchbox = screen.getByRole("searchbox");
    searchbox.focus();
    fireEvent.keyDown(searchbox, { key: " " });
    expect(play).not.toHaveBeenCalled();
    searchbox.blur();
    fireEvent.keyDown(document.body, { key: " " });
    expect(play).toHaveBeenCalledTimes(1);
  });

  it("does nothing with nothing to play", async () => {
    const { play } = serve();
    render(<DesktopPodcasts />);
    await loaded();
    fireEvent.keyDown(document.body, { key: " " });
    expect(play).not.toHaveBeenCalled();
  });
});

describe("opening a list of shows from Finder", () => {
  it("registers .opml with Finder, not other XML", () => {
    expect(podcastsApp.opens({ name: "Podcasts Subscriptions.OPML" })).toBe(true);
    expect(podcastsApp.opens({ name: "feed.xml" })).toBe(false);
  });

  it("follows the shows of a file asked for before the window opened", async () => {
    const { library } = serve();
    requestOpenFile({ app: "podcasts", id: "file-1", name: "Shows.opml" });
    render(<DesktopPodcasts />);
    await loaded();
    await waitFor(() => expect(library().shows.map((each) => each.title)).toContain("Fresh Air"));
    expect(takeOpenFileRequests("podcasts")).toEqual([]);
  });
});
