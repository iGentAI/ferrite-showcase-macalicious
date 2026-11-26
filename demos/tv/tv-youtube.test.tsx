import { act, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { app } from "./app";
import { TvYouTube } from "./tv-youtube";
import {
  emptyLibrary,
  finished,
  forgetPlace,
  know,
  LIMITS,
  libraryBytes,
  nextVideoId,
  opened,
  placed,
  previousVideoId,
  queue,
  removeFromHistory,
  type TvLibraryState,
  toggleWatchLater,
  tvLibraryFromServer,
  tvLibraryReadable,
  tvLibraryToServer,
  youTubeVideoId,
} from "./tv-youtube-data";
import type { YouTubePlayerOptions } from "./tv-youtube-player";
import { TV_LIBRARY_URL } from "./tv-youtube-server";

/*
 * Test double: `FakePlayer` stands in for YouTube's IFrame Player API (`YT.Player`), which these
 * tests never load. It records what the window asked of it and lets a test send the events
 * YouTube's player sends. Real playback is covered by e2e/tv-journey.mjs, not here.
 */
class FakePlayer {
  static last: FakePlayer | null = null;
  static made: FakePlayer[] = [];
  /** When set, `onReady` waits for `ready()`, as YouTube's does while its iframe loads. */
  static holdReady = false;
  time = 0;
  duration = 600;
  readonly options: YouTubePlayerOptions;
  setVolume = vi.fn();
  mute = vi.fn();
  unMute = vi.fn();
  destroy = vi.fn();
  constructor(element: HTMLElement, options: YouTubePlayerOptions) {
    this.options = options;
    FakePlayer.last = this;
    FakePlayer.made.push(this);
    const frame = document.createElement("iframe");
    frame.title = "YouTube video player";
    element.replaceWith(frame);
    if (!FakePlayer.holdReady) queueMicrotask(() => this.ready());
  }
  ready() {
    this.options.events?.onReady?.({ target: this });
  }
  playVideo() {
    this.emit(1);
  }
  pauseVideo() {
    this.emit(2);
  }
  seekTo(seconds: number) {
    this.time = seconds;
  }
  getCurrentTime() {
    return this.time;
  }
  getDuration() {
    return this.duration;
  }
  getVideoData() {
    return { title: "Big Buck Bunny 60fps 4K", author: "Blender" };
  }
  emit(data: number) {
    this.options.events?.onStateChange?.({ data, target: this });
  }
  fail(code: number) {
    this.options.events?.onError?.({ data: code, target: this });
  }
}

const BUNNY = "aqz-KE-bpKQ";
const LLAMAS = "SkVqJ1SGeL0";

beforeEach(() => {
  FakePlayer.last = null;
  FakePlayer.made = [];
  FakePlayer.holdReady = false;
  vi.stubGlobal("YT", { Player: FakePlayer });
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

const frame = () => screen.getByRole("region", { name: "TV" });
const field = () => screen.getByRole("searchbox", { name: "Search" });
const section = (name: string) => screen.getByRole("button", { name });
const player = () => screen.getByRole("region", { name: /^Playing / });
const cardTitles = (name: string) =>
  [...screen.getByRole("region", { name }).querySelectorAll(".mac-card-grid-card-title")].map(
    (title) => title.textContent,
  );

describe("the library", () => {
  it("reads a video id from every form of YouTube link, and nothing else", () => {
    for (const link of [
      BUNNY,
      `https://www.youtube.com/watch?v=${BUNNY}`,
      `https://www.youtube.com/watch?feature=share&v=${BUNNY}&t=42s`,
      `youtube.com/watch?v=${BUNNY}`,
      `https://m.youtube.com/watch?v=${BUNNY}`,
      `https://youtu.be/${BUNNY}?si=x`,
      `https://www.youtube-nocookie.com/embed/${BUNNY}`,
      `https://www.youtube.com/shorts/${BUNNY}`,
      `  https://WWW.YOUTUBE.COM/watch?v=${BUNNY}  `,
    ]) {
      expect(youTubeVideoId(link), link).toBe(BUNNY);
    }
    for (const link of [
      "",
      "llamas",
      "https://vimeo.com/123456789",
      "https://www.youtube.com/watch?v=short",
      `https://evil.example/watch?v=${BUNNY}`,
      `https://youtube.com.evil.example/watch?v=${BUNNY}`,
      "https://www.youtube.com/playlist?list=PL1",
    ]) {
      expect(youTubeVideoId(link), link).toBeUndefined();
    }
  });

  it("keeps History newest first and once per video, and names every listed video", () => {
    const bunny = { id: BUNNY, title: "Big Buck Bunny", channel: "Blender" };
    const llamas = { id: LLAMAS, title: "Caminandes 3", channel: "Blender" };
    let library = opened(emptyLibrary, bunny, 1);
    library = opened(library, llamas, 2);
    library = opened(library, bunny, 3);
    expect(library.history).toEqual([
      { id: BUNNY, at: 3 },
      { id: LLAMAS, at: 2 },
    ]);
    expect(library.videos.map((video) => video.id)).toEqual([BUNNY, LLAMAS]);

    library = toggleWatchLater(library, llamas);
    expect(library.watchLater).toEqual([LLAMAS]);
    expect(toggleWatchLater(library, llamas).watchLater).toEqual([]);

    library = queue(queue(library, bunny), llamas, "next");
    expect(library.upNext).toEqual([LLAMAS, BUNNY]);
    expect(finished(library, LLAMAS).upNext).toEqual([BUNNY]);

    // A known title is not replaced by the placeholder of a link not yet looked up.
    expect(know(library, { id: BUNNY, title: "YouTube video", channel: "" }).videos[0]?.title).toBe(
      "Big Buck Bunny",
    );
  });

  it("keeps a playing video's place to ten seconds, a paused one exactly, and forgets a finished one", () => {
    const library = know(emptyLibrary, { id: BUNNY, title: "Bunny", channel: "" });
    expect(placed(library, BUNNY, 47.9, 600, true).positions).toEqual({ [BUNNY]: 40 });
    expect(placed(library, BUNNY, 47.9, 600, false).positions).toEqual({ [BUNNY]: 47 });
    const started = placed(library, BUNNY, 300, 600, false);
    expect(placed(started, BUNNY, 590, 600, false).positions).toEqual({});
    expect(placed(started, BUNNY, 0, 600, false).positions).toEqual({});
    // A place in a video the library does not know is not kept: the server would refuse it.
    expect(placed(emptyLibrary, BUNNY, 30, 600, false)).toBe(emptyLibrary);
  });

  it("removes one entry from History or one place from Continue Watching", () => {
    const library: TvLibraryState = {
      ...emptyLibrary,
      history: [
        { id: "bbbbbbbbbb2", at: 2 },
        { id: "aaaaaaaaaa1", at: 1 },
      ],
      positions: { aaaaaaaaaa1: 30, bbbbbbbbbb2: 40 },
    };
    expect(removeFromHistory(library, "bbbbbbbbbb2")).toEqual({
      ...library,
      history: [{ id: "aaaaaaaaaa1", at: 1 }],
      positions: { aaaaaaaaaa1: 30 },
    });
    expect(forgetPlace(library, "aaaaaaaaaa1")).toEqual({
      ...library,
      positions: { bbbbbbbbbb2: 40 },
    });
  });

  it("finds what Next and Previous go to: Up Next first, then along History", () => {
    const library: TvLibraryState = {
      ...emptyLibrary,
      history: [
        { id: "cccccccccc3", at: 3 },
        { id: "bbbbbbbbbb2", at: 2 },
        { id: "aaaaaaaaaa1", at: 1 },
      ],
    };
    expect(previousVideoId(library, "cccccccccc3")).toBe("bbbbbbbbbb2");
    expect(previousVideoId(library, "aaaaaaaaaa1")).toBeUndefined();
    expect(nextVideoId(library, "bbbbbbbbbb2")).toBe("cccccccccc3");
    expect(nextVideoId(library, "cccccccccc3")).toBeUndefined();
    const queued = { ...library, upNext: ["cccccccccc3", "qqqqqqqqqq9"] };
    expect(nextVideoId(queued, "cccccccccc3")).toBe("qqqqqqqqqq9");
    expect(nextVideoId(queued, "aaaaaaaaaa1")).toBe("cccccccccc3");
  });

  it("lets the oldest unlisted video go at the limit, and reads only the module's shape", () => {
    let library: TvLibraryState = emptyLibrary;
    for (let n = 0; n < LIMITS.videos + 1; n += 1) {
      const id = `v${String(n).padStart(10, "0")}`;
      library = know(library, { id, title: `Video ${n}`, channel: "" });
      if (n === 0) library = toggleWatchLater(library, { id, title: "Video 0", channel: "" });
    }
    expect(library.videos).toHaveLength(LIMITS.videos);
    expect(library.videos[0]?.id).toBe("v0000000000");
    expect(library.videos[1]?.id).toBe("v0000000002");

    // Every known video listed: the oldest goes with its entries, never the new one.
    let full: TvLibraryState = emptyLibrary;
    for (let n = 0; n < LIMITS.videos; n += 1) {
      const listed = { id: `w${String(n).padStart(10, "0")}`, title: `W ${n}`, channel: "" };
      full = placed(know(full, listed), listed.id, 30, 600, false);
    }
    expect(Object.keys(full.positions)).toHaveLength(LIMITS.videos);
    const newest = { id: "aqz-KE-bpKQ", title: "Bunny", channel: "" };
    const after = opened(full, newest, 5);
    expect(after.videos).toHaveLength(LIMITS.videos);
    expect(after.videos.at(-1)?.id).toBe(newest.id);
    expect(after.history).toEqual([{ id: newest.id, at: 5 }]);
    const known = new Set(after.videos.map((video) => video.id));
    expect(Object.keys(after.positions).every((id) => known.has(id))).toBe(true);
    expect(after.positions).not.toHaveProperty("w0000000000");

    // A full Up Next keeps the video added and lets the one queued earliest make room.
    let queued: TvLibraryState = emptyLibrary;
    for (let n = 0; n < LIMITS.upNext; n += 1) {
      queued = queue(queued, {
        id: `q${String(n).padStart(10, "0")}`,
        title: `Q ${n}`,
        channel: "",
      });
    }
    const last = queue(queued, { id: BUNNY, title: "Bunny", channel: "" });
    expect(last.upNext).toHaveLength(LIMITS.upNext);
    expect(last.upNext.at(-1)).toBe(BUNNY);
    expect(last.upNext[0]).toBe("q0000000001");
    const next = queue(queued, { id: LLAMAS, title: "Llamas", channel: "" }, "next");
    expect(next.upNext).toHaveLength(LIMITS.upNext);
    expect(next.upNext[0]).toBe(LLAMAS);
    expect(next.upNext.at(-1)).toBe("q0000000198");

    expect(tvLibraryReadable({ library: null, rev: 0 })).toBe(true);
    expect(tvLibraryFromServer({ library: null })).toEqual(emptyLibrary);
    expect(tvLibraryReadable({ library: { ...emptyLibrary, upNext: ["not an id"] } })).toBe(false);
    expect(Object.keys(tvLibraryToServer(emptyLibrary).library)).toEqual([
      "videos",
      "history",
      "upNext",
      "watchLater",
      "positions",
    ]);
  });

  it("keeps the saved library under the server's byte limit with room for full lists", () => {
    // Titles and channels at their longest, in multibyte text: far fewer than LIMITS.videos fit.
    let library: TvLibraryState = emptyLibrary;
    for (let n = 0; n < 400; n += 1) {
      const video = {
        id: `b${String(n).padStart(10, "0")}`,
        title: "€".repeat(LIMITS.title),
        channel: "€".repeat(LIMITS.channel),
      };
      library = know(library, video);
      expect(library.videos.at(-1)?.id).toBe(video.id);
    }
    expect(library.videos.length).toBeLessThan(400);
    // History, Up Next, Watch Later and the places at their limits still fit.
    let filled = library;
    for (let n = 0; n < LIMITS.positions; n += 1) {
      filled = {
        ...filled,
        positions: { ...filled.positions, [`p${String(n).padStart(10, "0")}`]: LIMITS.position },
      };
    }
    const id = (n: number) => `h${String(n).padStart(10, "0")}`;
    filled = {
      ...filled,
      history: Array.from({ length: LIMITS.history }, (_, n) => ({ id: id(n), at: 1790000000000 })),
      upNext: Array.from({ length: LIMITS.upNext }, (_, n) => id(n)),
      watchLater: Array.from({ length: LIMITS.watchLater }, (_, n) => id(n)),
    };
    expect(libraryBytes(filled)).toBeLessThanOrEqual(LIMITS.bytes);
  });

  it("keeps to the byte limit when short titles are replaced by long ones", () => {
    // A full library of placeholders, then every title replaced by the longest multibyte one.
    let library: TvLibraryState = emptyLibrary;
    const id = (n: number) => `s${String(n).padStart(10, "0")}`;
    for (let n = 0; n < LIMITS.videos; n += 1) {
      library = know(library, { id: id(n), title: "YouTube video", channel: "" });
    }
    expect(library.videos).toHaveLength(LIMITS.videos);
    for (let n = 0; n < LIMITS.videos; n += 1) {
      const video = { id: id(n), title: "€".repeat(LIMITS.title), channel: "€".repeat(20) };
      library = know(library, video);
      // The video updated is always kept, with its new title.
      expect(library.videos.find((known) => known.id === video.id)?.title).toBe(video.title);
      expect(libraryBytes(library)).toBeLessThanOrEqual(LIMITS.bytes - 65_000);
    }
    expect(library.videos.length).toBeLessThan(LIMITS.videos);
  });
});

describe("the YouTube window", () => {
  it("is the window the desktop opens", () => {
    expect(app.component).toBe(TvYouTube);
  });

  it("sizes the Library's cards by the List Size the Preferences give it", async () => {
    const user = userEvent.setup();
    const library = toggleWatchLater(emptyLibrary, {
      id: BUNNY,
      title: "Big Buck Bunny",
      channel: "Blender",
    });
    const width = () =>
      (screen.getByRole("region", { name: "Watch Later" }) as HTMLElement).style.getPropertyValue(
        "--mac-card-grid-min-card-width",
      );
    const { rerender } = render(<TvYouTube served={false} defaultLibrary={library} />);
    await user.click(section("Library"));
    expect(width()).toBe("220px");
    rerender(
      <TvYouTube served={false} defaultLibrary={library} settings={{ listSize: "large" }} />,
    );
    expect(width()).toBe("288px");
    rerender(
      <TvYouTube served={false} defaultLibrary={library} settings={{ listSize: "small" }} />,
    );
    expect(width()).toBe("160px");
  });

  it("plays a pasted link in YouTube's player under TV's controls, and keeps it in History", async () => {
    const user = userEvent.setup();
    render(<TvYouTube served={false} />);
    await user.type(field(), `https://youtu.be/${BUNNY}{Enter}`);

    await waitFor(() => expect(FakePlayer.last).not.toBeNull());
    const made = FakePlayer.last as FakePlayer;
    expect(made.options.videoId).toBe(BUNNY);
    expect(made.options.host).toBe("https://www.youtube-nocookie.com");
    expect(made.options.playerVars).toMatchObject({ controls: 0, playsinline: 1, autoplay: 1 });
    // The title YouTube's player reports names the player and the video.
    await waitFor(() => expect(player()).toHaveAccessibleName("Playing Big Buck Bunny 60fps 4K"));
    expect(player()).toHaveAttribute("data-state", "playing");
    const controls = within(screen.getByRole("group", { name: "Playback controls" }));

    made.time = 42;
    await waitFor(() => expect(controls.getByText("0:42")).toBeInTheDocument());
    expect(controls.getByText("-9:18")).toBeInTheDocument();

    await user.click(controls.getByRole("button", { name: "Pause" }));
    expect(player()).toHaveAttribute("data-state", "paused");
    await user.click(controls.getByRole("button", { name: "Forward 10 seconds" }));
    expect(made.time).toBe(52);
    await user.click(controls.getByRole("button", { name: "Mute" }));
    expect(made.mute).toHaveBeenCalled();
    await user.click(controls.getByRole("button", { name: "Add to Watch Later" }));
    expect(controls.getByRole("button", { name: "Remove from Watch Later" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );

    await user.click(screen.getByRole("button", { name: "Done" }));
    expect(made.destroy).toHaveBeenCalled();
    expect(screen.getByRole("button", { name: "Resume from 0:52" })).toBeInTheDocument();

    await user.click(section("Library"));
    expect(cardTitles("Watch Later")).toEqual(["Big Buck Bunny 60fps 4K"]);
    expect(cardTitles("History")).toEqual(["Big Buck Bunny 60fps 4K"]);
    await user.click(screen.getByRole("button", { name: "Clear History" }));
    expect(screen.queryByRole("region", { name: "History" })).toBeNull();
    expect(cardTitles("Watch Later")).toEqual(["Big Buck Bunny 60fps 4K"]);
  });

  it("leaves YouTube's player uncovered, so its own prompts and controls take the pointer", async () => {
    const user = userEvent.setup();
    render(<TvYouTube served={false} />);
    await user.type(field(), `https://youtu.be/${BUNNY}{Enter}`);
    await waitFor(() => expect(FakePlayer.last).not.toBeNull());
    const iframe = player().querySelector("iframe") as HTMLIFrameElement;
    const box = iframe.parentElement as HTMLElement;
    // The video's box holds YouTube's iframe alone: no surface of TV's lies over it.
    expect([...box.children]).toEqual([iframe]);
    // TV's title row is above the video and its controller below it, beside it in the layout.
    const parts = [...player().children];
    const title = screen.getByRole("group", { name: "Video" }).parentElement as HTMLElement;
    const controls = screen.getByRole("group", { name: "Playback controls" })
      .parentElement as HTMLElement;
    expect(parts.indexOf(title)).toBeLessThan(parts.indexOf(box));
    expect(parts.indexOf(controls)).toBeGreaterThan(parts.indexOf(box));
  });

  it("keeps the playback controls off until YouTube's player is ready", async () => {
    FakePlayer.holdReady = true;
    const user = userEvent.setup();
    render(<TvYouTube served={false} />);
    await user.type(field(), `https://youtu.be/${BUNNY}{Enter}`);
    await waitFor(() => expect(FakePlayer.last).not.toBeNull());
    const made = FakePlayer.last as FakePlayer;
    const playVideo = vi.spyOn(made, "playVideo");
    const controls = within(screen.getByRole("group", { name: "Playback controls" }));
    for (const name of ["Play", "Mute", "Full Volume", "Forward 10 seconds"]) {
      expect(controls.getByRole("button", { name })).toHaveAttribute("aria-disabled", "true");
    }
    // A press before then asks nothing of a player that cannot answer yet.
    await user.click(controls.getByRole("button", { name: "Play" }));
    await user.click(controls.getByRole("button", { name: "Mute" }));
    expect(playVideo).not.toHaveBeenCalled();
    expect(made.mute).not.toHaveBeenCalled();
    // Ready: the window starts the video and the controls work.
    act(() => made.ready());
    expect(playVideo).toHaveBeenCalledTimes(1);
    expect(controls.getByRole("button", { name: "Mute" })).not.toHaveAttribute(
      "aria-disabled",
      "true",
    );
    await user.click(controls.getByRole("button", { name: "Mute" }));
    expect(made.mute).toHaveBeenCalled();
  });

  it("says in its own words when YouTube will not play, and offers YouTube itself", async () => {
    const user = userEvent.setup();
    const open = vi.fn();
    vi.stubGlobal("open", open);
    render(<TvYouTube served={false} />);
    await user.click(section("Kids"));
    await user.click(screen.getByRole("button", { name: /Caminandes 3/ }));
    await user.click(screen.getByRole("button", { name: "Play" }));
    await waitFor(() => expect(FakePlayer.last).not.toBeNull());
    act(() => (FakePlayer.last as FakePlayer).fail(150));
    expect(screen.getByRole("alert")).toHaveTextContent("YouTube will not play this video here");
    expect(player()).toHaveAttribute("data-error", "150");
    await user.click(screen.getByRole("button", { name: "Watch on YouTube" }));
    expect(open).toHaveBeenCalledWith(
      `https://www.youtube.com/watch?v=${LLAMAS}`,
      "_blank",
      "noopener,noreferrer",
    );
  });

  it("plays the next video of Up Next when one ends", async () => {
    const user = userEvent.setup();
    const library = queue(emptyLibrary, {
      id: LLAMAS,
      title: "Caminandes 3: Llamigos",
      channel: "Blender",
    });
    render(<TvYouTube served={false} defaultLibrary={library} />);
    expect(cardTitles("Up Next")).toEqual(["Caminandes 3: Llamigos"]);
    await user.click(section("Kids"));
    await user.click(screen.getByRole("button", { name: /Big Buck Bunny/ }));
    await user.click(screen.getByRole("button", { name: "Play" }));
    await waitFor(() => expect(FakePlayer.last?.options.videoId).toBe(BUNNY));
    act(() => (FakePlayer.last as FakePlayer).emit(0));
    await waitFor(() => expect(FakePlayer.last?.options.videoId).toBe(LLAMAS));
    await user.click(screen.getByRole("button", { name: "Done" }));
    await user.click(section("Watch Now"));
    expect(screen.queryByRole("region", { name: "Up Next" })).toBeNull();
  });
});

describe("TV on the desktop's Ferrite application", () => {
  /** Test double for the desktop app's `/api/tv/` routes: answers from `routes` by path. */
  function serve(routes: Record<string, unknown>) {
    vi.stubEnv("VITE_MACALICIOUS_API", "1");
    const fetch = vi.fn(async (url: string, init?: RequestInit) => {
      const path = url.split("?")[0] ?? url;
      const body =
        init?.method === "PUT" ? { ...JSON.parse(String(init.body)), rev: 2 } : routes[path];
      return { ok: true, status: 200, json: async () => body };
    });
    vi.stubGlobal("fetch", fetch);
    return fetch;
  }
  const saves = (fetch: ReturnType<typeof serve>) =>
    fetch.mock.calls
      .filter(([, init]) => init?.method === "PUT")
      .map(([url, init]) => ({ url, body: JSON.parse(String(init?.body)) }));

  it("names a pasted link with YouTube's oEmbed title and saves Watch Later", async () => {
    const user = userEvent.setup();
    const fetch = serve({
      [TV_LIBRARY_URL]: { library: null, rev: 0 },
      "/api/tv/video": { id: LLAMAS, title: "Caminandes 3: Llamigos", channel: "Blender" },
    });
    render(<TvYouTube />);
    await waitFor(() => expect(frame()).not.toHaveAttribute("aria-busy"));
    await user.type(field(), `https://www.youtube.com/watch?v=${LLAMAS}`);
    await waitFor(() => expect(cardTitles("YouTube Link")).toEqual(["Caminandes 3: Llamigos"]));
    // The id alone is sent: the server builds YouTube's canonical address from it.
    expect(fetch.mock.calls.some(([url]) => url === `/api/tv/video?link=${LLAMAS}`)).toBe(true);
    await user.click(screen.getByRole("button", { name: "Add to Watch Later" }));
    await waitFor(() => expect(saves(fetch).at(-1)?.body.library.watchLater).toEqual([LLAMAS]));
    expect(saves(fetch).at(-1)?.body.library.videos).toEqual([
      { id: LLAMAS, title: "Caminandes 3: Llamigos", channel: "Blender" },
    ]);
  });

  it("gives a video queued before YouTube answered its real title once the answer comes", async () => {
    const user = userEvent.setup();
    let answer: (value: unknown) => void = () => {};
    // A video TV does not know: not one of its built-in films.
    const ZOO = "jNQXAC9IVRw";
    const lookup = new Promise((resolve) => {
      answer = resolve;
    });
    vi.stubEnv("VITE_MACALICIOUS_API", "1");
    const fetch = vi.fn(async (url: string, init?: RequestInit) => {
      const path = url.split("?")[0] ?? url;
      if (path === "/api/tv/video") {
        const body = await lookup;
        return { ok: true, status: 200, json: async () => body };
      }
      const body =
        init?.method === "PUT"
          ? { ...JSON.parse(String(init.body)), rev: 2 }
          : { library: null, rev: 0 };
      return { ok: true, status: 200, json: async () => body };
    });
    vi.stubGlobal("fetch", fetch);
    render(<TvYouTube />);
    await waitFor(() => expect(frame()).not.toHaveAttribute("aria-busy"));
    await user.type(field(), `https://youtu.be/${ZOO}`);
    await user.click(screen.getByRole("button", { name: "Add to Up Next" }));
    // The person moves on before YouTube answers.
    await user.clear(field());
    await waitFor(() =>
      expect(saves(fetch).at(-1)?.body.library.videos).toEqual([
        { id: ZOO, title: "YouTube video", channel: "" },
      ]),
    );
    act(() => answer({ id: ZOO, title: "Me at the zoo", channel: "jawed" }));
    await waitFor(() =>
      expect(saves(fetch).at(-1)?.body.library.videos).toEqual([
        { id: ZOO, title: "Me at the zoo", channel: "jawed" },
      ]),
    );
    expect(saves(fetch).at(-1)?.body.library.upNext).toEqual([ZOO]);
    expect(cardTitles("Up Next")).toEqual(["Me at the zoo"]);
  });

  it("says that searching YouTube needs a key the desktop has not been given", async () => {
    const user = userEvent.setup();
    serve({
      [TV_LIBRARY_URL]: { library: null, rev: 0 },
      "/api/tv/search": { available: false, results: [] },
    });
    render(<TvYouTube />);
    await waitFor(() => expect(frame()).not.toHaveAttribute("aria-busy"));
    await user.type(field(), "llamas");
    await waitFor(() =>
      expect(screen.getByRole("status")).toHaveTextContent("needs a YouTube Data API key"),
    );
  });
});
