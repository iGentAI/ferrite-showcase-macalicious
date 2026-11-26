import { act, cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/**
 * DesktopMusic in jsdom. `fetch` stands in for the desktop's Ferrite application and the
 * Internet Archive routes (its replies are the module's shapes, not real Archive data), and the
 * media element's `play`, `pause` and `load` are stubbed, since jsdom plays nothing: this checks
 * what the window asks of the server and the player, not sound.
 */

const stored = {
  songs: [
    {
      id: "up-1",
      title: "Harbour Bell",
      artist: "Ada Rowan",
      album: "Slow Tide",
      genre: "Folk",
      year: 2019,
      track: 3,
      duration: 229,
      added: 1,
      artwork: null,
      source: { kind: "file", file: "f1", name: "bell.mp3", type: "audio/mpeg", size: 4_000_000 },
    },
  ],
  playlists: [],
  loved: [],
};

const item = {
  identifier: "DWK255",
  title: "Saturne (EP)",
  creator: "Subjectjazz",
  year: 2014,
  license: "http://creativecommons.org/licenses/by-nc-nd/4.0/",
  tracks: [
    {
      id: "Subjectjazz_-_01_-_NSIME",
      title: "NSIME",
      artist: "Subjectjazz",
      album: "Saturne (EP)",
      track: 1,
      duration: 121,
      files: { mp3: "Subjectjazz_-_01_-_NSIME.mp3" },
    },
  ],
};

function serve(initial: unknown = stored) {
  vi.stubEnv("VITE_MACALICIOUS_API", "1");
  let library: unknown = initial;
  let preferences: unknown = null;
  let lyrics: unknown = null;
  const fetch = vi.fn(async (url: string, init?: RequestInit) => {
    const path = url.split("?")[0];
    const reply = (body: unknown, status = 200) => ({
      ok: status < 400,
      status,
      json: async () => body,
    });
    if (path === "/api/music/preferences") {
      if (init?.method === "PUT") {
        preferences = JSON.parse(String(init.body)).preferences;
        return reply({ preferences, rev: 2 });
      }
      return reply({ preferences, rev: preferences ? 2 : 0, session: "s1" });
    }
    if (path === "/api/music/lyrics") {
      if (init?.method === "PUT") {
        lyrics = JSON.parse(String(init.body)).lyrics;
        return reply({ lyrics, rev: 2 });
      }
      return reply({ lyrics, rev: lyrics ? 2 : 0, session: "s1" });
    }
    if (path === "/api/music/library") {
      if (init?.method === "PUT") {
        library = JSON.parse(String(init.body)).library;
        return reply({ library, rev: 2 });
      }
      return reply({ library, rev: 1, session: "s1" });
    }
    if (path === "/api/music/playback") {
      if (init?.method === "PUT") return reply({ ...JSON.parse(String(init.body)), rev: 2 });
      return reply({ playback: null, rev: 0, session: "s1" });
    }
    if (path === "/api/music/archive/search") {
      return reply({
        results: [
          {
            identifier: "DWK255",
            title: "Saturne (EP)",
            creator: "Subjectjazz",
            year: 2014,
            license: item.license,
          },
        ],
        total: 1,
        page: 1,
        rows: 24,
      });
    }
    if (path === "/api/music/archive/item/DWK255") return reply(item);
    return reply({ error: "not found" }, 404);
  });
  vi.stubGlobal("fetch", fetch);
  return fetch;
}

const libraryPuts = (fetch: ReturnType<typeof serve>) =>
  fetch.mock.calls
    .filter(([url, init]) => url === "/api/music/library" && init?.method === "PUT")
    .map(([, init]) => JSON.parse(String(init?.body)).library);

const preferencePuts = (fetch: ReturnType<typeof serve>) =>
  fetch.mock.calls
    .filter(([url, init]) => url === "/api/music/preferences" && init?.method === "PUT")
    .map(([, init]) => JSON.parse(String(init?.body)).preferences);

/** Whether a check box is dimmed: Base UI marks it both ways. */
const dimmed = (box: HTMLElement) =>
  box.getAttribute("aria-disabled") === "true" || box.hasAttribute("data-disabled");

async function mount() {
  vi.resetModules();
  const { DesktopMusic } = await import("./music-desktop");
  render(<DesktopMusic />);
  const window = screen.getByRole("region", { name: "Music" });
  await waitFor(() => expect(window).not.toHaveAttribute("aria-busy"));
  return window;
}

/** Close Music and open it again: what it shows then is what the server stored. */
async function reopen() {
  cleanup();
  return mount();
}

const place = (window: HTMLElement, name: string) =>
  within(within(window).getByRole("tree", { name: "Music" })).getByRole("treeitem", { name });

/**
 * The Preferences window's OK. `serve` keeps no playback, so a save read back in a long test finds
 * it forgotten, and the banner saying so has an OK of its own, earlier in the page.
 */
const preferencesOk = () => screen.getAllByRole("button", { name: "OK" }).at(-1) as HTMLElement;

let played: HTMLMediaElement[] = [];
beforeEach(() => {
  played = [];
  vi.spyOn(HTMLMediaElement.prototype, "play").mockImplementation(function (
    this: HTMLMediaElement,
  ) {
    played.push(this);
    return Promise.resolve();
  });
  vi.spyOn(HTMLMediaElement.prototype, "pause").mockImplementation(() => {});
  vi.spyOn(HTMLMediaElement.prototype, "load").mockImplementation(() => {});
  vi.spyOn(HTMLMediaElement.prototype, "canPlayType").mockImplementation((type: string) =>
    type.startsWith("audio/mpeg") ? "probably" : "",
  );
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

describe("Music on the Ferrite desktop", () => {
  it("is the demo window wherever the desktop's Ferrite application does not serve it", async () => {
    vi.resetModules();
    const fetch = vi.fn();
    vi.stubGlobal("fetch", fetch);
    const { DesktopMusic } = await import("./music-desktop");
    render(<DesktopMusic />);
    expect(screen.getByRole("button", { name: /Night Lines/ })).toBeInTheDocument();
    expect(fetch).not.toHaveBeenCalled();
  });

  it("waits for the playback to be read before taking commands", async () => {
    const fetch = serve();
    const served = fetch.getMockImplementation() as NonNullable<
      ReturnType<typeof fetch.getMockImplementation>
    >;
    let answer = () => {};
    const held = new Promise<void>((resolve) => {
      answer = resolve;
    });
    fetch.mockImplementation(async (url, init) => {
      if (url.split("?")[0] === "/api/music/playback" && !init?.method) await held;
      return served(url, init);
    });
    vi.resetModules();
    const { DesktopMusic } = await import("./music-desktop");
    render(<DesktopMusic />);
    const window = screen.getByRole("region", { name: "Music" });
    await waitFor(() =>
      expect(fetch.mock.calls.some(([url]) => url.startsWith("/api/music/library"))).toBe(true),
    );
    await new Promise((resolve) => setTimeout(resolve, 50));
    expect(window).toHaveAttribute("aria-busy", "true");
    const song = new File([new Uint8Array(64)], "tone.mp3", { type: "audio/mpeg" });
    fireEvent.drop(window, { dataTransfer: { files: [song], types: ["Files"] } });
    expect(within(window).getByText(/still loading/)).toBeInTheDocument();
    expect(fetch.mock.calls.some(([url]) => url.startsWith("/api/files"))).toBe(false);
    answer();
    await waitFor(() => expect(window).not.toHaveAttribute("aria-busy"));
  });

  it("stays closed to commands, and says why, when the library cannot be read", async () => {
    const fetch = serve("not a library");
    vi.resetModules();
    const { DesktopMusic } = await import("./music-desktop");
    render(<DesktopMusic />);
    const window = screen.getByRole("region", { name: "Music" });
    expect(await within(window).findByText(/could not be read/)).toBeInTheDocument();
    expect(window).toHaveAttribute("aria-busy", "true");
    expect(libraryPuts(fetch)).toEqual([]);
    // The window can still be closed, and the explanation is not hidden with the commands.
    expect(within(window).getByRole("button", { name: "Close" }).closest("[inert]")).toBeNull();
    expect(within(window).getByRole("alert").closest("[inert]")).toBeNull();
    expect(
      window.querySelector('[aria-label="Playback controls"]')?.closest("[inert]"),
    ).not.toBeNull();
  });

  it("shows the song Spotlight asks for, selected in Songs, once the library has been read", async () => {
    serve();
    vi.resetModules();
    const { openItem } = await import("../desktop/desktop-open-item");
    openItem({ app: "music", id: "up-1", title: "Harbour Bell" });
    const { DesktopMusic } = await import("./music-desktop");
    render(<DesktopMusic />);
    const window = screen.getByRole("region", { name: "Music" });
    const table = await within(window).findByRole("grid", { name: "Songs" });
    expect(within(table).getByRole("row", { name: /Harbour Bell/ })).toHaveAttribute(
      "aria-selected",
      "true",
    );

    await userEvent.click(place(window, "Albums"));
    act(() => openItem({ app: "music", id: "deleted-since", title: "Gone" }));
    expect(within(window).queryByRole("grid", { name: "Songs" })).toBeNull();
    act(() => openItem({ app: "music", id: "up-1", title: "Harbour Bell" }));
    expect(await within(window).findByRole("grid", { name: "Songs" })).toBeInTheDocument();
  });

  it("shows the person's library from the server and saves a song loved", async () => {
    const fetch = serve();
    const window = await mount();
    expect(within(window).getByRole("button", { name: /Slow Tide/ })).toBeInTheDocument();
    expect(within(window).queryByRole("button", { name: /Night Lines/ })).toBeNull();
    await userEvent.click(place(window, "Songs"));
    const table = within(window).getByRole("grid", { name: "Songs" });
    expect(within(table).getByText("Harbour Bell")).toBeInTheDocument();
    await userEvent.click(within(table).getByRole("button", { name: "Love Harbour Bell" }));
    await waitFor(() => expect(libraryPuts(fetch).at(-1)?.loved).toEqual(["up-1"]));
    await userEvent.click(place(window, "Loved Songs"));
    expect(
      within(within(window).getByRole("grid", { name: "Loved Songs" })).getByText("Harbour Bell"),
    ).toBeInTheDocument();
    const reopened = await reopen();
    await userEvent.click(place(reopened, "Loved Songs"));
    expect(within(reopened).getByRole("grid", { name: "Loved Songs" })).toHaveTextContent(
      "Harbour Bell",
    );
  });

  it("leaves a song's file out of the Trash when the library cannot be saved without the song", async () => {
    const fetch = serve();
    const window = await mount();
    await userEvent.click(place(window, "Songs"));
    const table = within(window).getByRole("grid", { name: "Songs" });
    fireEvent.mouseDown(within(table).getByText("Harbour Bell"));
    const refused = fetch.getMockImplementation();
    fetch.mockImplementation(async (url: string, init?: RequestInit) => {
      if (url === "/api/music/library" && init?.method === "PUT")
        return { ok: false, status: 400, json: async () => ({ error: "refused" }) };
      return refused?.(url, init) as never;
    });
    fireEvent.keyDown(table, { key: "Backspace" });
    await userEvent.click(await screen.findByRole("button", { name: "Move to Trash" }));
    await screen.findByText(/files stay in Music on your drive/);
    expect(
      fetch.mock.calls.some(([, init]) => String(init?.body ?? "").includes('"op":"trash"')),
    ).toBe(false);
  });

  it("leaves a file in Music when another window's song names it by the time the library is saved", async () => {
    const fetch = serve();
    const window = await mount();
    await userEvent.click(place(window, "Songs"));
    const table = within(window).getByRole("grid", { name: "Songs" });
    fireEvent.mouseDown(within(table).getByText("Harbour Bell"));
    const answer = fetch.getMockImplementation();
    let put = false;
    fetch.mockImplementation(async (url: string, init?: RequestInit) => {
      if (url === "/api/music/library" && init?.method === "PUT") put = true;
      // Once the deletion is saved, the library read back holds a song with that very file.
      if (url === "/api/music/library" && !init?.method && put) {
        return { ok: true, status: 200, json: async () => ({ library: stored, rev: 3 }) };
      }
      return answer?.(url, init) as never;
    });
    fireEvent.keyDown(table, { key: "Backspace" });
    await userEvent.click(await screen.findByRole("button", { name: "Move to Trash" }));
    await waitFor(() => expect(put).toBe(true));
    await new Promise((resolve) => setTimeout(resolve, 50));
    expect(
      fetch.mock.calls.some(([, init]) => String(init?.body ?? "").includes('"op":"trash"')),
    ).toBe(false);
  });

  it("keeps playlist folders, and each playlist's place in them, when a song is deleted", async () => {
    const fetch = serve({
      ...stored,
      playlists: [{ id: "pl-a", name: "Road", songs: ["up-1"], folder: "f-a" }],
      folders: [{ id: "f-a", name: "Trips" }],
    });
    const window = await mount();
    await userEvent.click(place(window, "Songs"));
    const table = within(window).getByRole("grid", { name: "Songs" });
    fireEvent.mouseDown(within(table).getByText("Harbour Bell"));
    fireEvent.keyDown(table, { key: "Backspace" });
    await userEvent.click(await screen.findByRole("button", { name: "Keep File" }));
    await waitFor(() => expect(libraryPuts(fetch).length).toBeGreaterThan(0));
    const reopened = await reopen();
    const trips = place(reopened, "Trips");
    expect(trips).toHaveAttribute("aria-expanded");
    if (trips.getAttribute("aria-expanded") === "false") await userEvent.click(trips);
    const road = place(reopened, "Road");
    expect(road).toHaveAttribute("aria-level", "2");
    await userEvent.click(road);
    expect(within(reopened).getByRole("grid", { name: "Road" })).not.toHaveTextContent(
      "Harbour Bell",
    );
  });

  it("keeps two Music windows one library: a change in one builds on the other's", async () => {
    const fetch = serve();
    vi.resetModules();
    const { DesktopMusic } = await import("./music-desktop");
    render(
      <>
        <DesktopMusic />
        <DesktopMusic />
      </>,
    );
    const [first, second] = screen.getAllByRole("region", { name: "Music" }) as [
      HTMLElement,
      HTMLElement,
    ];
    await waitFor(() => {
      expect(first).not.toHaveAttribute("aria-busy");
      expect(second).not.toHaveAttribute("aria-busy");
    });
    // The first window adds an Internet Archive item...
    await userEvent.click(place(first, "Browse"));
    await userEvent.click(await within(first).findByRole("button", { name: /Saturne \(EP\)/ }));
    await within(first).findByRole("grid", { name: "Tracks of Saturne (EP)" });
    await userEvent.click(within(first).getByRole("button", { name: "Add to Library" }));
    await waitFor(() => expect(libraryPuts(fetch).at(-1)?.songs).toHaveLength(2));
    // ...and the second, which loaded before it, loves a song: its save keeps the added one.
    await userEvent.click(place(second, "Songs"));
    const table = within(second).getByRole("grid", { name: "Songs" });
    expect(within(table).getByText("NSIME")).toBeInTheDocument();
    await userEvent.click(within(table).getByRole("button", { name: "Love Harbour Bell" }));
    await waitFor(() => expect(libraryPuts(fetch).at(-1)?.loved).toEqual(["up-1"]));
    expect(
      libraryPuts(fetch)
        .at(-1)
        ?.songs.map((s: { title: string }) => s.title),
    ).toEqual(["Harbour Bell", "NSIME"]);
  });

  it("ends a playlist rename begun in one playlist when another is shown", async () => {
    const fetch = serve({
      ...stored,
      playlists: [
        { id: "pa", name: "Mix A", songs: ["up-1"] },
        { id: "pb", name: "Mix B", songs: [] },
      ],
    });
    const window = await mount();
    await userEvent.click(place(window, "Mix A"));
    await userEvent.dblClick(within(window).getByRole("heading", { name: "Mix A" }));
    const field = within(window).getByRole("textbox", { name: "Playlist name" });
    await userEvent.clear(field);
    await userEvent.type(field, "Renamed");
    await userEvent.click(place(window, "Mix B"));
    expect(within(window).getByRole("heading", { name: "Mix B" })).toBeInTheDocument();
    expect(within(window).queryByRole("textbox", { name: "Playlist name" })).toBeNull();
    // Mix B was never renamed.
    for (const put of libraryPuts(fetch)) {
      expect(put.playlists.find((p: { id: string }) => p.id === "pb")?.name).toBe("Mix B");
    }
  });

  it("searches the Internet Archive again when the same words are submitted in the sidebar", async () => {
    const fetch = serve();
    const window = await mount();
    await userEvent.click(place(window, "Browse"));
    const searches = () =>
      fetch.mock.calls.filter(
        ([url]) => url.startsWith("/api/music/archive/search") && url.includes("q=jazz"),
      ).length;
    const field = within(window).getByPlaceholderText("Internet Archive");
    await userEvent.type(field, "jazz{Enter}");
    await waitFor(() => expect(searches()).toBe(1));
    await userEvent.type(field, "jazz{Enter}");
    await waitFor(() => expect(searches()).toBe(2));
  });

  it("plays an Internet Archive track from archive.org and adds the item to the library", async () => {
    const fetch = serve();
    const window = await mount();
    await userEvent.click(place(window, "Browse"));
    const card = await within(window).findByRole("button", { name: /Saturne \(EP\)/ });
    await userEvent.click(card);
    const tracks = await within(window).findByRole("grid", { name: "Tracks of Saturne (EP)" });
    expect(within(window).getByRole("link", { name: "CC BY-NC-ND 4.0" })).toHaveAttribute(
      "href",
      item.license,
    );
    const row = within(tracks)
      .getAllByRole("row")
      .find((r) => r.textContent?.includes("NSIME"));
    fireEvent.doubleClick(row as HTMLElement);
    await waitFor(() =>
      expect(played.at(-1)?.src).toBe(
        "https://archive.org/download/DWK255/Subjectjazz_-_01_-_NSIME.mp3",
      ),
    );
    expect(within(window).getByRole("group", { name: "Now Playing" })).toHaveTextContent("NSIME");
    await userEvent.click(within(window).getByRole("button", { name: "Add to Library" }));
    await waitFor(() =>
      expect(
        libraryPuts(fetch)
          .at(-1)
          ?.songs.map((s: { title: string }) => s.title),
      ).toEqual(["Harbour Bell", "NSIME"]),
    );
    expect(libraryPuts(fetch).at(-1)?.songs[1].source).toMatchObject({
      kind: "archive",
      item: "DWK255",
      license: item.license,
    });
    const reopened = await reopen();
    await userEvent.click(place(reopened, "Songs"));
    expect(within(reopened).getByRole("grid", { name: "Songs" })).toHaveTextContent("NSIME");
  });

  it("refuses a file that is not a song, and says so", async () => {
    serve();
    const window = await mount();
    const input = window.querySelector<HTMLInputElement>('input[type="file"]');
    fireEvent.change(input as HTMLInputElement, {
      target: { files: [new File(["x"], "notes.txt", { type: "text/plain" })] },
    });
    expect(await within(window).findByRole("alert")).toHaveTextContent("notes.txt");
  });

  it("sends a change made just before the page goes with a request that outlives the page", async () => {
    const fetch = serve();
    const window = await mount();
    // Players of the earlier tests' windows listen too (one per page in use): only the request
    // carrying this window's change is counted, and nothing more may follow it.
    const keepalive = () =>
      fetch.mock.calls.filter(
        ([url, init]) =>
          url.split("?")[0] === "/api/music/playback" &&
          init?.method === "PUT" &&
          init?.keepalive === true,
      );
    const repeated = () =>
      keepalive().filter(([, init]) => JSON.parse(String(init?.body)).playback.repeat === "all");
    // Repeat is pressed and the page goes before its save waited out its grouping.
    await userEvent.click(within(window).getByRole("button", { name: "Repeat: Off" }));
    globalThis.window.dispatchEvent(new Event("pagehide"));
    expect(repeated()).toHaveLength(1);
    // Nothing changed since: nothing more is sent as the page goes again.
    const sent = keepalive().length;
    globalThis.window.dispatchEvent(new Event("pagehide"));
    expect(keepalive()).toHaveLength(sent);
  });

  it("sends the change again as the page next goes when the last such save was refused", async () => {
    const fetch = serve();
    const served = fetch.getMockImplementation() as NonNullable<
      ReturnType<typeof fetch.getMockImplementation>
    >;
    fetch.mockImplementation(async (url, init) =>
      init?.keepalive
        ? ({ ok: false, status: 500, json: async () => ({}) } as never)
        : served(url, init),
    );
    const window = await mount();
    const repeated = () =>
      fetch.mock.calls.filter(
        ([url, init]) =>
          url.split("?")[0] === "/api/music/playback" &&
          init?.keepalive === true &&
          JSON.parse(String(init?.body)).playback.repeat === "all",
      );
    await userEvent.click(within(window).getByRole("button", { name: "Repeat: Off" }));
    globalThis.window.dispatchEvent(new Event("pagehide"));
    const first = repeated().length;
    expect(first).toBeGreaterThan(0);
    await waitFor(async () => {
      globalThis.window.dispatchEvent(new Event("pagehide"));
      expect(repeated().length).toBeGreaterThan(first);
    });
  });

  it("sends the change again as the page goes while its save is still on its way", async () => {
    const fetch = serve();
    const served = fetch.getMockImplementation() as NonNullable<
      ReturnType<typeof fetch.getMockImplementation>
    >;
    // Saves of the playback are held unanswered, as one cut off by the page unloading would be.
    const held: (() => void)[] = [];
    let leaving = false;
    fetch.mockImplementation(async (url, init) => {
      if (url.split("?")[0] === "/api/music/playback" && init?.method === "PUT" && !leaving) {
        await new Promise<void>((resolve) => held.push(resolve));
      }
      return served(url, init);
    });
    const window = await mount();
    const keepalive = () =>
      fetch.mock.calls.filter(
        ([url, init]) =>
          url.split("?")[0] === "/api/music/playback" &&
          init?.method === "PUT" &&
          init?.keepalive === true,
      );
    // Shuffle on, a change no earlier test's window made, so only this window's request carries it.
    await userEvent.click(within(window).getByRole("button", { name: "Shuffle" }));
    // The grouped save goes out and is held on its way.
    await waitFor(() => expect(held.length).toBeGreaterThan(0), { timeout: 3_000 });
    const sent = keepalive().length;
    leaving = true;
    globalThis.window.dispatchEvent(new Event("pagehide"));
    const shuffled = keepalive()
      .slice(sent)
      .filter(([, init]) => JSON.parse(String(init?.body)).playback.shuffle === true);
    expect(shuffled).toHaveLength(1);
    for (const release of held) release();
  });

  it("sends a playback the page went back to while another save is on its way", async () => {
    const fetch = serve();
    const served = fetch.getMockImplementation() as NonNullable<
      ReturnType<typeof fetch.getMockImplementation>
    >;
    let holding = false;
    let leaving = false;
    const held: (() => void)[] = [];
    fetch.mockImplementation(async (url, init) => {
      const save = url.split("?")[0] === "/api/music/playback" && init?.method === "PUT";
      if (save && holding && !leaving) await new Promise<void>((resolve) => held.push(resolve));
      return served(url, init);
    });
    const window = await mount();
    const keepalive = () =>
      fetch.mock.calls.filter(
        ([url, init]) =>
          url.split("?")[0] === "/api/music/playback" &&
          init?.method === "PUT" &&
          init?.keepalive === true,
      );
    const puts = () =>
      fetch.mock.calls.filter(
        ([url, init]) => url.split("?")[0] === "/api/music/playback" && init?.method === "PUT",
      ).length;
    // A: Repeat All, stored.
    const before = puts();
    await userEvent.click(within(window).getByRole("button", { name: "Repeat: Off" }));
    await waitFor(() => expect(puts()).toBeGreaterThan(before), { timeout: 3_000 });
    await new Promise((resolve) => setTimeout(resolve, 50));
    // B: Shuffle on, its save held on its way; then back to A before B's answer.
    holding = true;
    await userEvent.click(within(window).getByRole("button", { name: "Shuffle" }));
    await waitFor(() => expect(held.length).toBeGreaterThan(0), { timeout: 3_000 });
    await userEvent.click(within(window).getByRole("button", { name: "Shuffle" }));
    const sent = keepalive().length;
    leaving = true;
    globalThis.window.dispatchEvent(new Event("pagehide"));
    const sentAsItWent = keepalive()
      .slice(sent)
      .map(([, init]) => JSON.parse(String(init?.body)).playback);
    expect(sentAsItWent.some((p) => p.repeat === "all" && p.shuffle === false)).toBe(true);
    for (const release of held) release();
  });

  it("asks the desktop to bring Music forward at ⌥⌘1, in its window and in its MiniPlayer", async () => {
    serve();
    const window = await mount();
    const asked: unknown[] = [];
    const hear = (event: Event) => asked.push((event as CustomEvent).detail);
    globalThis.addEventListener("macalicious:desktop-effects", hear);
    fireEvent.keyDown(window, { key: "1", code: "Digit1", altKey: true, ctrlKey: true });
    expect(asked).toEqual([[{ open: "music" }]]);
    fireEvent.keyDown(window, { key: "m", code: "KeyM", shiftKey: true, ctrlKey: true });
    const mini = await screen.findByRole("region", { name: "MiniPlayer" });
    fireEvent.keyDown(mini, { key: "1", code: "Digit1", altKey: true, ctrlKey: true });
    expect(asked).toHaveLength(2);
    globalThis.removeEventListener("macalicious:desktop-effects", hear);
  });

  it("shows the Audio output button unavailable, saying why", async () => {
    serve();
    const window = await mount();
    const output = within(window).getByRole("button", { name: "Audio output" });
    expect(output.hasAttribute("disabled") || output.getAttribute("aria-disabled") === "true").toBe(
      true,
    );
    expect(output).toHaveAttribute(
      "title",
      expect.stringMatching(/isn’t available in this browser/),
    );
  });

  it("waits for stored Preferences before opening an editable draft, then keeps the change", async () => {
    const fetch = serve();
    const served = fetch.getMockImplementation() as NonNullable<
      ReturnType<typeof fetch.getMockImplementation>
    >;
    let release!: () => void;
    const held = new Promise<void>((resolve) => {
      release = resolve;
    });
    let first = true;
    fetch.mockImplementation(async (url, init) => {
      if (url.split("?")[0] === "/api/music/preferences" && !init?.method && first) {
        first = false;
        await held;
        return {
          ok: true,
          status: 200,
          json: async () => ({
            preferences: {
              crossfade: false,
              soundCheck: true,
              listSize: "small",
              notifications: true,
              miniPlayerOnTop: false,
            },
            rev: 1,
            session: "s1",
          }),
        };
      }
      return served(url, init);
    });
    vi.resetModules();
    const { DesktopMusic } = await import("./music-desktop");
    const close = vi.fn();
    // The desktop menu can request this portal before Music's own busy window is ready.
    render(<DesktopMusic preferencesOpen onPreferencesOpenChange={close} />);
    await waitFor(() => expect(first).toBe(false));
    expect(screen.getByRole("region", { name: "Music" })).toHaveAttribute("aria-busy", "true");
    expect(screen.queryByRole("checkbox", { name: "When song changes" })).not.toBeInTheDocument();
    expect(preferencePuts(fetch)).toEqual([]);
    await act(async () => {
      release();
    });
    await userEvent.click(await screen.findByRole("tab", { name: "Playback" }));
    expect(screen.getByRole("checkbox", { name: "Sound Check" })).toHaveAttribute(
      "aria-checked",
      "true",
    );
    const crossfade = screen.getByRole("checkbox", { name: "Crossfade songs" });
    expect(crossfade).toHaveAttribute("aria-checked", "false");
    await userEvent.click(crossfade);
    await userEvent.click(preferencesOk());
    expect(close).toHaveBeenCalledWith(false);
    await waitFor(() =>
      expect(preferencePuts(fetch).at(-1)).toMatchObject({
        crossfade: true,
        soundCheck: true,
        listSize: "small",
      }),
    );
    const reopened = await reopen();
    fireEvent.keyDown(reopened, { key: ",", metaKey: true });
    await userEvent.click(await screen.findByRole("tab", { name: "Playback" }));
    expect(screen.getByRole("checkbox", { name: "Crossfade songs" })).toHaveAttribute(
      "aria-checked",
      "true",
    );
    expect(screen.getByRole("checkbox", { name: "Sound Check" })).toHaveAttribute(
      "aria-checked",
      "true",
    );
  });

  it("keeps the Preferences this desktop carries out, and dims the others with the reason", async () => {
    const fetch = serve();
    const window = await mount();
    fireEvent.keyDown(window, { key: ",", metaKey: true });
    const notify = await screen.findByRole("checkbox", { name: "When song changes" });
    expect(notify).toHaveAttribute("aria-checked", "true");
    expect(dimmed(notify)).toBe(false);
    // The iTunes Store is not on this desktop: dimmed, unticked, and the note says why.
    const store = screen.getByRole("checkbox", { name: "iTunes Store" });
    expect(dimmed(store)).toBe(true);
    expect(store).toHaveAttribute("aria-checked", "false");
    expect(screen.getByText(/The iTunes Store is not part of this desktop/)).toBeInTheDocument();
    await userEvent.click(screen.getByRole("tab", { name: "Playback" }));
    // The Playback pane acts: none of its settings is dimmed, and its sliders follow their boxes.
    const crossfade = screen.getByRole("checkbox", { name: "Crossfade songs" });
    expect(dimmed(crossfade)).toBe(false);
    expect(screen.getByRole("slider", { name: "Crossfade length" })).toBeDisabled();
    await userEvent.click(crossfade);
    expect(screen.getByRole("slider", { name: "Crossfade length" })).toBeEnabled();
    expect(screen.getByText("6 seconds")).toBeInTheDocument();
    await userEvent.click(screen.getByRole("checkbox", { name: "Sound Check" }));
    await userEvent.click(screen.getByRole("tab", { name: "General" }));
    await userEvent.click(screen.getByRole("checkbox", { name: "When song changes" }));
    await userEvent.click(screen.getByRole("tab", { name: "Advanced" }));
    await userEvent.click(
      screen.getByRole("checkbox", { name: "Keep on top of all other windows" }),
    );
    // A dimmed box does not change, however it is pressed.
    const always = screen.getByRole("checkbox", {
      name: "Add songs to Library when adding to playlists",
    });
    await userEvent.click(always);
    expect(always).toHaveAttribute("aria-checked", "true");
    await userEvent.click(preferencesOk());
    await waitFor(() =>
      expect(preferencePuts(fetch).at(-1)).toEqual({
        listSize: "medium",
        notifications: false,
        miniPlayerOnTop: true,
        starRatings: true,
        songCheckboxes: false,
        crossfade: true,
        crossfadeSeconds: 6,
        soundEnhancer: false,
        soundEnhancerLevel: 50,
        soundCheck: true,
      }),
    );
    // Opened again, Music shows what the server kept.
    const reopened = await reopen();
    fireEvent.keyDown(reopened, { key: ",", metaKey: true });
    expect(await screen.findByRole("checkbox", { name: "When song changes" })).toHaveAttribute(
      "aria-checked",
      "false",
    );
  });

  it("says so when the Preferences cannot be read, and keeps none of a change", async () => {
    const fetch = serve();
    const served = fetch.getMockImplementation() as NonNullable<
      ReturnType<typeof fetch.getMockImplementation>
    >;
    fetch.mockImplementation(async (url, init) => {
      if (url.split("?")[0] === "/api/music/preferences" && !init?.method) {
        return { ok: true, status: 200, json: async () => ({ preferences: "garbled", rev: 1 }) };
      }
      return served(url, init);
    });
    const window = await mount();
    expect(await within(window).findByRole("alert")).toHaveTextContent(
      /preferences could not be read/,
    );
    fireEvent.keyDown(window, { key: ",", metaKey: true });
    await userEvent.click(await screen.findByRole("checkbox", { name: "When song changes" }));
    await userEvent.click(preferencesOk());
    await new Promise((resolve) => setTimeout(resolve, 50));
    expect(preferencePuts(fetch)).toEqual([]);
  });
});

describe("Music when its documents are forgotten in another browser", () => {
  const tide = {
    id: "ia-tide",
    title: "Tide Line",
    artist: "Subjectjazz",
    album: "Saturne (EP)",
    genre: "",
    year: null,
    track: 1,
    duration: 121,
    added: 1,
    artwork: null,
    source: {
      kind: "archive",
      item: "DWK255",
      files: { mp3: "Subjectjazz_-_01_-_NSIME.mp3" },
      license: item.license,
    },
  };

  /**
   * A server that keeps each document under a revision, as `document.rs` does: a `PUT` on another
   * revision is refused with 409 and the stored copy, and a library without its songs is refused
   * with 400. `forget` deletes a document as another browser would, with no word to this page.
   */
  function serveRevisions(playback: unknown = null) {
    // The Internet Archive routes and anything else that is not one of the documents are
    // answered by the fixture server.
    const fixtures = serve().getMockImplementation() as NonNullable<
      ReturnType<ReturnType<typeof serve>["getMockImplementation"]>
    >;
    const docs: Record<string, { field: string; body: unknown; rev: number }> = {
      "/api/music/library": {
        field: "library",
        body: { songs: [tide], playlists: [], loved: [] },
        rev: 1,
      },
      "/api/music/playback": { field: "playback", body: playback, rev: playback ? 1 : 0 },
      "/api/music/preferences": { field: "preferences", body: null, rev: 0 },
    };
    const refused: number[] = [];
    /** Runs before each read of a document: what another browser does just before it. */
    const hooks: { beforeRead?: (path: string) => void } = {};
    const fetch = vi.fn(async (url: string, init?: RequestInit) => {
      const path = url.split("?")[0] as string;
      const reply = (body: unknown, status = 200) => ({
        ok: status < 400,
        status,
        json: async () => body,
      });
      const doc = docs[path];
      if (!doc) return fixtures(url, init);
      if (init?.method === "PUT") {
        const sent = JSON.parse(String(init.body));
        if (sent.rev !== doc.rev) {
          return reply({ [doc.field]: doc.body, rev: doc.rev, error: "changed elsewhere" }, 409);
        }
        const body = sent[doc.field];
        if (doc.field === "library" && !Array.isArray(body?.songs)) {
          refused.push(400);
          return reply({ error: "missing field `songs`" }, 400);
        }
        doc.body = body;
        doc.rev += 1;
        return reply({ [doc.field]: doc.body, rev: doc.rev });
      }
      hooks.beforeRead?.(path);
      return reply({ [doc.field]: doc.body, rev: doc.rev, session: "s1" });
    });
    vi.stubGlobal("fetch", fetch);
    const forget = (path: string) => {
      const doc = docs[path] as { body: unknown; rev: number };
      doc.body = null;
      doc.rev += 1;
    };
    return { fetch, docs, forget, refused, hooks };
  }

  it("goes on saving playback after it was forgotten, keeping only the song loaded", async () => {
    const { docs, forget } = serveRevisions();
    const window = await mount();
    await userEvent.click(place(window, "Songs"));
    const row = within(within(window).getByRole("grid", { name: "Songs" }))
      .getAllByRole("row")
      .find((r) => r.textContent?.includes("Tide Line"));
    fireEvent.doubleClick(row as HTMLElement);
    const playback = docs["/api/music/playback"] as {
      body: { queue: string[]; recent: string[]; repeat: string; shuffle: boolean } | null;
      rev: number;
    };
    await waitFor(() => expect(playback.body?.queue).toEqual(["ia-tide"]), { timeout: 3_000 });
    expect(playback.body?.recent).toEqual(["ia-tide"]);

    // Another browser forgets the playback; this page is not told.
    forget("/api/music/playback");
    const forgottenAt = playback.rev;
    // A change of this page's (jsdom plays nothing, so a pause would change no place) meets the
    // forgotten document; the page reads it and saves onto it, the change included.
    await userEvent.click(within(window).getByRole("button", { name: "Repeat: Off" }));
    await waitFor(() => expect(playback.rev).toBeGreaterThan(forgottenAt), { timeout: 3_000 });
    expect(playback.body?.queue).toEqual(["ia-tide"]);
    expect(playback.body?.recent).toEqual([]);
    expect(playback.body?.repeat).toBe("all");
    expect(within(window).getByRole("alert")).toHaveTextContent(/playback was forgotten/);

    // And it keeps saving: the next change is stored too, not dropped.
    const before = playback.rev;
    await userEvent.click(within(window).getByRole("button", { name: "Shuffle" }));
    await waitFor(() => expect(playback.body?.shuffle).toBe(true), { timeout: 3_000 });
    expect(playback.rev).toBeGreaterThan(before);
  });

  it("takes up a forget that another browser saved over first, rather than bring back its history", async () => {
    const empty = {
      queue: [],
      unshuffled: [],
      index: 0,
      position: 0,
      shuffle: false,
      repeat: "off",
      volume: 100,
      recent: [],
      plays: {},
      guests: [],
      order: [],
    };
    const { docs } = serveRevisions({ ...empty, epoch: "pb-first" });
    const window = await mount();
    await userEvent.click(place(window, "Songs"));
    const row = within(within(window).getByRole("grid", { name: "Songs" }))
      .getAllByRole("row")
      .find((r) => r.textContent?.includes("Tide Line"));
    fireEvent.doubleClick(row as HTMLElement);
    const playback = docs["/api/music/playback"] as {
      body: { queue: string[]; recent: string[]; repeat: string; epoch?: string } | null;
      rev: number;
    };
    await waitFor(() => expect(playback.body?.queue).toEqual(["ia-tide"]), { timeout: 3_000 });
    expect(playback.body?.epoch).toBe("pb-first");

    // Another browser forgets the playback and, before this page saves again, plays a song of
    // its own: the stored playback has another epoch and none of this page's history.
    playback.body = {
      ...empty,
      queue: ["ia-elsewhere"],
      recent: ["ia-elsewhere"],
      epoch: "pb-second",
    };
    playback.rev += 2;
    await userEvent.click(within(window).getByRole("button", { name: "Repeat: Off" }));
    await waitFor(() => expect(playback.body?.queue).toEqual(["ia-tide"]), { timeout: 3_000 });
    expect(playback.body?.epoch).toBe("pb-second");
    expect(playback.body?.recent).toEqual([]);
    expect(playback.body?.repeat).toBe("all");
    expect(within(window).getByRole("alert")).toHaveTextContent(/playback was forgotten/);
  });

  it("takes up a forget saved over by another browser after this page named the playback itself", async () => {
    const { docs, fetch } = serveRevisions();
    const window = await mount();
    await userEvent.click(place(window, "Songs"));
    const row = within(within(window).getByRole("grid", { name: "Songs" }))
      .getAllByRole("row")
      .find((r) => r.textContent?.includes("Tide Line"));
    fireEvent.doubleClick(row as HTMLElement);
    const playback = docs["/api/music/playback"] as {
      body: { queue: string[]; recent: string[]; epoch?: string } | null;
      rev: number;
    };
    // The playback was empty: this page names it, saves it, and reads it back once.
    await waitFor(() => expect(playback.body?.epoch).toMatch(/^pb-/), { timeout: 3_000 });
    const reads = () =>
      fetch.mock.calls.filter(
        ([url, init]) => url.split("?")[0] === "/api/music/playback" && !init?.method,
      ).length;
    await waitFor(() => expect(reads()).toBeGreaterThanOrEqual(2), { timeout: 3_000 });

    // Another browser forgets the playback and saves one of its own under another name.
    const elsewhere = {
      queue: ["ia-elsewhere"],
      unshuffled: [],
      index: 0,
      position: 0,
      shuffle: false,
      repeat: "off",
      volume: 100,
      recent: ["ia-elsewhere"],
      plays: {},
      guests: [],
      order: [],
      epoch: "pb-elsewhere",
    };
    playback.body = elsewhere;
    playback.rev += 2;
    await userEvent.click(within(window).getByRole("button", { name: "Repeat: Off" }));
    await waitFor(() => expect(playback.body?.epoch).toBe("pb-elsewhere"), { timeout: 3_000 });
    await waitFor(() => expect(playback.body?.queue).toEqual(["ia-tide"]), { timeout: 3_000 });
    expect(playback.body?.recent).toEqual([]);
    expect(within(window).getByRole("alert")).toHaveTextContent(/playback was forgotten/);
  });

  it("takes up a forget saved elsewhere between this page's first save and its reading back", async () => {
    const { docs, hooks } = serveRevisions();
    const playback = docs["/api/music/playback"] as {
      body: { queue: string[]; recent: string[]; epoch?: string } | null;
      rev: number;
    };
    // The second read of the playback (the page reading back the name it gave it) finds that
    // another browser forgot it and saved one of its own in the meantime.
    let reads = 0;
    hooks.beforeRead = (path) => {
      if (path !== "/api/music/playback") return;
      reads += 1;
      if (reads !== 2) return;
      playback.body = {
        queue: ["ia-elsewhere"],
        unshuffled: [],
        index: 0,
        position: 0,
        shuffle: false,
        repeat: "off",
        volume: 100,
        recent: ["ia-elsewhere"],
        plays: {},
        guests: [],
        order: [],
        epoch: "pb-elsewhere",
      } as never;
      playback.rev += 2;
    };
    const window = await mount();
    await userEvent.click(place(window, "Songs"));
    const row = within(within(window).getByRole("grid", { name: "Songs" }))
      .getAllByRole("row")
      .find((r) => r.textContent?.includes("Tide Line"));
    fireEvent.doubleClick(row as HTMLElement);
    // The page takes the forget up from the read itself and saves onto the other playback,
    // without its history: no later conflict is needed for it.
    await waitFor(() => expect(reads).toBeGreaterThanOrEqual(2), { timeout: 3_000 });
    await waitFor(() => expect(playback.body?.queue).toEqual(["ia-tide"]), { timeout: 3_000 });
    expect(playback.body?.epoch).toBe("pb-elsewhere");
    expect(playback.body?.recent).toEqual([]);
    expect(within(window).getByRole("alert")).toHaveTextContent(/playback was forgotten/);
  });

  it("shows a library forgotten elsewhere and says the change was not kept", async () => {
    const { docs, forget, fetch, refused } = serveRevisions();
    const window = await mount();
    await userEvent.click(place(window, "Songs"));
    forget("/api/music/library");
    await userEvent.click(
      within(within(window).getByRole("grid", { name: "Songs" })).getByRole("button", {
        name: "Love Tide Line",
      }),
    );
    expect(await within(window).findByRole("alert", {}, { timeout: 3_000 })).toHaveTextContent(
      /library was forgotten/,
    );
    // Nothing of the change was applied to nothing and sent: no library without its songs.
    expect(refused).toEqual([]);
    expect((docs["/api/music/library"] as { body: unknown }).body).toBeNull();
    await userEvent.click(place(window, "Albums"));
    expect(within(window).getByText("Your library is empty.")).toBeInTheDocument();

    // A change made from here is stored on the forgotten library.
    await userEvent.click(place(window, "Browse"));
    await userEvent.click(await within(window).findByRole("button", { name: /Saturne \(EP\)/ }));
    await within(window).findByRole("grid", { name: "Tracks of Saturne (EP)" });
    await userEvent.click(within(window).getByRole("button", { name: "Add to Library" }));
    await waitFor(
      () =>
        expect(
          (docs["/api/music/library"] as { body: { songs: unknown[] } | null }).body?.songs,
        ).toHaveLength(1),
      { timeout: 3_000 },
    );
    expect(fetch).toHaveBeenCalled();
  });
});

const twoSources = {
  songs: [
    stored.songs[0],
    {
      id: "ia-1",
      title: "Tide Line",
      artist: "Bo Lund",
      album: "Saturne",
      genre: "",
      year: 2014,
      track: 1,
      duration: 120,
      added: 2,
      artwork: null,
      source: {
        kind: "archive",
        item: "DWK255",
        files: { mp3: "a.mp3" },
        license: item.license,
      },
    },
  ],
  playlists: [],
  loved: [],
};

describe("Music's fuller commands on the Ferrite desktop", () => {
  const song = (window: HTMLElement, name: string) =>
    within(within(window).getByRole("grid", { name: "Songs" })).getByRole("row", {
      name: new RegExp(name),
    });

  /** Open Song Info on a row of Songs. */
  async function openInfo(window: HTMLElement, title: string) {
    await userEvent.click(place(window, "Songs"));
    await userEvent.click(song(window, title));
    fireEvent.keyDown(window, { key: "i", ctrlKey: true });
    await screen.findByLabelText("Song Info");
  }
  /** A pane of Song Info's segmented control. */
  const pane = (name: string) =>
    userEvent.click(within(screen.getByLabelText("Song Info")).getByText(name));

  it("Song Info saves Grouping, Options and Sorting on the song, and the list sorts by them", async () => {
    const fetch = serve(twoSources);
    const window = await mount();
    await openInfo(window, "Harbour Bell");
    await userEvent.type(screen.getByLabelText("Grouping"), "Morning");
    await pane("Options");
    await userEvent.type(screen.getByLabelText("Start"), "0:30");
    await userEvent.type(screen.getByLabelText("Stop"), "1:30");
    await userEvent.click(screen.getByRole("checkbox", { name: "Skip when shuffling" }));
    await pane("Sorting");
    await userEvent.type(screen.getByLabelText("Sort Name"), "Zzz");
    await userEvent.click(screen.getByRole("button", { name: "OK" }));
    await waitFor(() => {
      const saved = libraryPuts(fetch).at(-1)?.songs[0];
      expect(saved).toMatchObject({
        grouping: "Morning",
        start: 30,
        stop: 90,
        skipShuffle: true,
        sortName: "Zzz",
      });
    });
    // Sorted by name, “Zzz” now comes after Tide Line.
    const rows = within(within(window).getByRole("grid", { name: "Songs" })).getAllByRole("row");
    expect(rows.at(-1)).toHaveTextContent("Harbour Bell");
  });

  it("refuses a start time that is not a time, and saves nothing", async () => {
    const fetch = serve(twoSources);
    const window = await mount();
    await openInfo(window, "Harbour Bell");
    await pane("Options");
    await userEvent.type(screen.getByLabelText("Start"), "soon");
    await userEvent.click(screen.getByRole("button", { name: "OK" }));
    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Start must be a time, such as 1:30.",
    );
    expect(libraryPuts(fetch)).toEqual([]);
  });

  it("keeps lyrics typed in Song Info, and shows them in the Lyrics panel of the song playing", async () => {
    const fetch = serve(twoSources);
    const window = await mount();
    await openInfo(window, "Tide Line");
    await pane("Lyrics");
    await userEvent.type(
      screen.getByRole("textbox", { name: "Lyrics" }),
      "First line{enter}Second",
    );
    await userEvent.click(screen.getByRole("button", { name: "OK" }));
    await waitFor(() =>
      expect(
        fetch.mock.calls
          .filter(([url, init]) => url === "/api/music/lyrics" && init?.method === "PUT")
          .map(([, init]) => JSON.parse(String(init?.body)).lyrics)
          .at(-1),
      ).toEqual({ "ia-1": "First line\nSecond" }),
    );
    await userEvent.dblClick(song(window, "Tide Line"));
    await userEvent.click(within(window).getByRole("button", { name: "Lyrics" }));
    const panel = within(window).getByRole("complementary", { name: "Lyrics" });
    expect(panel).toHaveTextContent("First line Second");
  });

  it("Up Next's History lists the songs played, plays one, and Clear forgets them", async () => {
    serve(twoSources);
    const window = await mount();
    await userEvent.click(place(window, "Songs"));
    await userEvent.dblClick(song(window, "Tide Line"));
    await userEvent.click(within(window).getByRole("button", { name: "Up Next" }));
    const panel = within(window).getByRole("complementary", { name: "Up Next" });
    await userEvent.click(within(panel).getByText("History"));
    expect(within(panel).getByText("Tide Line")).toBeInTheDocument();
    await userEvent.click(within(panel).getByRole("button", { name: "Clear" }));
    expect(within(panel).getByText("No History")).toBeInTheDocument();
  });

  it("lists only the songs on the drive under Downloaded", async () => {
    serve(twoSources);
    const window = await mount();
    await userEvent.click(place(window, "Downloaded"));
    const grid = within(window).getByRole("grid", { name: "Downloaded" });
    expect(within(grid).getByText("Harbour Bell")).toBeInTheDocument();
    expect(within(grid).queryByText("Tide Line")).toBeNull();
  });

  it("shows Apple's services in the sidebar dimmed, saying why, and Radio open", async () => {
    serve();
    const window = await mount();
    for (const name of ["For You", "iTunes Store"]) {
      const row = place(window, name);
      expect(row).toHaveAttribute("aria-disabled", "true");
      expect(row).toHaveAttribute("title", expect.stringMatching(/not part of this desktop/));
    }
    expect(place(window, "Radio")).not.toHaveAttribute("aria-disabled", "true");
  });

  it("turns to the Internet Archive from the search results' scope bar", async () => {
    const fetch = serve(twoSources);
    const window = await mount();
    await userEvent.type(within(window).getByRole("searchbox"), "tide");
    expect(within(window).getByRole("radio", { name: "Library" })).toBeChecked();
    await userEvent.click(within(window).getByRole("radio", { name: "Internet Archive" }));
    await waitFor(() =>
      expect(
        fetch.mock.calls.some(([url]) => url === "/api/music/archive/search?q=tide&page=1"),
      ).toBe(true),
    );
    expect(
      within(window).getAllByRole("searchbox", { name: "Search the Internet Archive" }).length,
    ).toBeGreaterThan(0);
  });

  it("selects a song by typing the first letters of its title", async () => {
    serve(twoSources);
    const window = await mount();
    await userEvent.click(place(window, "Songs"));
    await userEvent.click(song(window, "Harbour Bell"));
    await userEvent.keyboard("ti");
    await waitFor(() => expect(song(window, "Tide Line")).toHaveAttribute("aria-selected", "true"));
    expect(song(window, "Harbour Bell")).toHaveAttribute("aria-selected", "false");
  });

  it("Songs list checkboxes and Star ratings follow Preferences, and a cleared box is saved", async () => {
    const fetch = serve(twoSources);
    const window = await mount();
    await userEvent.click(place(window, "Songs"));
    expect(within(window).queryByRole("checkbox", { name: "Play Harbour Bell" })).toBeNull();
    fireEvent.keyDown(window, { key: ",", metaKey: true });
    await userEvent.click(await screen.findByRole("checkbox", { name: "Songs list checkboxes" }));
    await userEvent.click(screen.getByRole("checkbox", { name: "Star ratings" }));
    await userEvent.click(preferencesOk());
    await waitFor(() =>
      expect(preferencePuts(fetch).at(-1)).toMatchObject({
        songCheckboxes: true,
        starRatings: false,
      }),
    );
    await userEvent.click(
      await within(window).findByRole("checkbox", { name: "Play Harbour Bell" }),
    );
    await waitFor(() =>
      expect(libraryPuts(fetch).at(-1)?.songs[0]).toMatchObject({ unchecked: true }),
    );
  });

  it("gives an artist's heading the album menu's commands, on all the artist's songs", async () => {
    const fetch = serve(twoSources);
    const window = await mount();
    await userEvent.click(place(window, "Artists"));
    fireEvent.contextMenu(within(window).getByRole("heading", { name: "Bo Lund" }));
    const menu = await screen.findByRole("menu", { name: "Bo Lund" });
    await userEvent.click(within(menu).getByRole("menuitem", { name: "Love" }));
    await waitFor(() => expect(libraryPuts(fetch).at(-1)?.loved).toEqual(["ia-1"]));
  });
});
