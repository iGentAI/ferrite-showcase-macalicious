import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MenuBar, MenuBarMenu } from "macalicious/menu-bar";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useDesktopAppMenuItems } from "../desktop/desktop-app-menus";
import { TV_PREFERENCES_URL, TV_UNAVAILABLE_SETTINGS } from "./tv-settings";
import { TvYouTube } from "./tv-youtube";
import type { YouTubePlayerOptions } from "./tv-youtube-player";
import { TV_LIBRARY_URL } from "./tv-youtube-server";

/*
 * TV on the desktop: its Preferences kept for the person, and the menu bar's Controls menu.
 * Test doubles, named for what they stand in for:
 * - `fetch` answers as the desktop's TV module does: its library and preferences documents,
 *   keeping what is `PUT`; no server is reached.
 * - `YT` stands in for YouTube's IFrame Player API: its player becomes ready, plays and pauses as
 *   it is told, or refuses the video with error 150 as YouTube does from a data-centre network.
 *   Nothing reaches YouTube.
 */

const BUNNY = "aqz-KE-bpKQ";
const LINK = `https://youtu.be/${BUNNY}`;

class FakePlayer {
  static last: FakePlayer | null = null;
  static refuse = false;
  options: YouTubePlayerOptions;
  seekTo = vi.fn();
  setVolume = vi.fn();
  mute = vi.fn();
  unMute = vi.fn();
  destroy = vi.fn();
  constructor(element: HTMLElement, options: YouTubePlayerOptions) {
    this.options = options;
    FakePlayer.last = this;
    element.replaceWith(document.createElement("iframe"));
    queueMicrotask(() => {
      options.events?.onReady?.({ target: this });
      if (FakePlayer.refuse) options.events?.onError?.({ data: 150, target: this });
    });
  }
  emit(data: number) {
    this.options.events?.onStateChange?.({ data, target: this });
  }
  playVideo() {
    if (!FakePlayer.refuse) this.emit(1);
  }
  pauseVideo() {
    this.emit(2);
  }
  getCurrentTime() {
    return 30;
  }
  getDuration() {
    return 600;
  }
}

/** The desktop's TV module: its two documents, by path, keeping what is saved. */
function serve(library: unknown, preferences: unknown) {
  vi.stubEnv("VITE_MACALICIOUS_API", "1");
  const documents: Record<string, Record<string, unknown>> = {
    [TV_LIBRARY_URL]: { library, rev: 1 },
    [TV_PREFERENCES_URL]: { preferences, rev: 1 },
  };
  const fetch = vi.fn(async (url: string, init?: RequestInit) => {
    const path = url.split("?")[0] ?? url;
    const kept = documents[path];
    if (!kept) return { ok: false, status: 404, json: async () => ({ error: "not found" }) };
    if (init?.method === "PUT") {
      const sent = JSON.parse(String(init.body)) as Record<string, unknown>;
      const { session: _session, ...body } = sent;
      documents[path] = { ...body, rev: Number(kept.rev) + 1 };
    }
    const answer = documents[path];
    return { ok: true, status: 200, json: async () => answer };
  });
  vi.stubGlobal("fetch", fetch);
  return fetch;
}
const puts = (fetch: ReturnType<typeof serve>, url: string) =>
  fetch.mock.calls
    .filter(([to, init]) => to === url && init?.method === "PUT")
    .map(([, init]) => JSON.parse(String(init?.body)));

const frame = () => screen.getByRole("region", { name: "TV" });
const field = () => screen.getByRole("searchbox", { name: "Search" });
const unavailable = (element: HTMLElement) =>
  element.hasAttribute("disabled") ||
  element.getAttribute("aria-disabled") === "true" ||
  element.hasAttribute("data-disabled");

function ControlsMenu() {
  const items = useDesktopAppMenuItems("tv", "Controls");
  return (
    <MenuBar aria-label="Menus">
      <MenuBarMenu title="Controls">{items}</MenuBarMenu>
    </MenuBar>
  );
}

beforeEach(() => {
  FakePlayer.last = null;
  FakePlayer.refuse = false;
  vi.stubGlobal("YT", { Player: FakePlayer });
});
afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

describe("TV's Preferences on the desktop", () => {
  it("keeps List Size for the person, and dims every other setting with its reason", async () => {
    const user = userEvent.setup({ pointerEventsCheck: 0 });
    const fetch = serve(
      {
        videos: [{ id: BUNNY, title: "Big Buck Bunny", channel: "Blender" }],
        history: [],
        upNext: [],
        watchLater: [BUNNY],
        positions: {},
      },
      { listSize: "large" },
    );
    render(<TvYouTube />);
    await waitFor(() => expect(frame()).not.toHaveAttribute("aria-busy"));
    const width = () =>
      (screen.getByRole("region", { name: "Watch Later" }) as HTMLElement).style.getPropertyValue(
        "--mac-card-grid-min-card-width",
      );
    await user.click(screen.getByRole("button", { name: "Library" }));
    // The List Size the server holds sizes the Library's cards.
    expect(width()).toBe("288px");

    fireEvent.keyDown(field(), { key: ",", metaKey: true });
    const general = await screen.findByRole("dialog", { name: "General" });
    const downloads = within(general).getByRole("checkbox", {
      name: "Always check for available downloads",
    });
    expect(unavailable(downloads)).toBe(true);
    expect(downloads).toHaveAttribute("title", TV_UNAVAILABLE_SETTINGS.checkDownloads.reason);
    expect(general).toHaveTextContent(TV_UNAVAILABLE_SETTINGS.checkDownloads.reason);
    expect(
      unavailable(within(general).getByRole("checkbox", { name: "Checkboxes in library" })),
    ).toBe(false);
    expect(within(general).getByRole("combobox", { name: "List Size:" })).toHaveTextContent(
      "Large",
    );

    await user.click(within(general).getByRole("combobox", { name: "List Size:" }));
    await user.click(await screen.findByRole("option", { name: "Small" }));
    await user.click(within(general).getByRole("button", { name: "OK" }));
    await waitFor(() =>
      expect(puts(fetch, TV_PREFERENCES_URL).at(-1)?.preferences).toEqual({ listSize: "small" }),
    );
    expect(screen.queryByRole("dialog", { name: "General" })).toBeNull();
    expect(width()).toBe("160px");
  });

  it("starts from the reference settings before the person has saved any", async () => {
    serve(null, null);
    render(<TvYouTube preferencesOpen />);
    await waitFor(() => expect(frame()).not.toHaveAttribute("aria-busy"));
    const general = await screen.findByRole("dialog", { name: "General" });
    expect(within(general).getByRole("combobox", { name: "List Size:" })).toHaveTextContent(
      "Medium",
    );
  });
});

describe("TV's Controls menu on the desktop", () => {
  it("plays a pasted link, adds it to Up Next and Watch Later, and pauses and skips in the player", async () => {
    const user = userEvent.setup({ pointerEventsCheck: 0 });
    render(
      <>
        <ControlsMenu />
        <TvYouTube served={false} />
      </>,
    );
    const item = async (name: string) => {
      await user.click(screen.getByRole("menuitem", { name: "Controls" }));
      return screen.findByRole("menuitem", { name });
    };
    const choose = async (name: string) => user.click(await item(name));

    // Nothing shown: nothing to play or skip.
    expect(unavailable(await item("Play"))).toBe(true);
    expect(unavailable(screen.getByRole("menuitem", { name: "Skip Forward 10 Seconds" }))).toBe(
      true,
    );
    await user.keyboard("{Escape}");

    await user.type(field(), LINK);
    await choose("Add to Watch Later");
    expect(screen.getByRole("button", { name: "Remove from Watch Later" })).toBeInTheDocument();
    await choose("Add to Up Next");
    expect(await item("Remove from Up Next")).toBeInTheDocument();
    await user.keyboard("{Escape}");

    // Play opens the player; YouTube's player plays, and Controls pauses and skips it.
    await choose("Play");
    const player = await screen.findByRole("region", { name: /^Playing / });
    await waitFor(() => expect(player).toHaveAttribute("data-state", "playing"));
    await choose("Pause");
    await waitFor(() => expect(player).toHaveAttribute("data-state", "paused"));
    await choose("Skip Forward 10 Seconds");
    expect(FakePlayer.last?.seekTo).toHaveBeenLastCalledWith(40, true);
    await choose("Play");
    await waitFor(() => expect(player).toHaveAttribute("data-state", "playing"));
  });

  it("dims Play, Pause and the skips when YouTube refuses the video, and keeps Watch Later", async () => {
    const user = userEvent.setup({ pointerEventsCheck: 0 });
    FakePlayer.refuse = true;
    render(
      <>
        <ControlsMenu />
        <TvYouTube served={false} />
      </>,
    );
    await user.type(field(), `${LINK}{Enter}`);
    expect(await screen.findByRole("alert")).toHaveTextContent(/will not play this video here/);
    expect(screen.getByRole("button", { name: "Watch on YouTube" })).toBeInTheDocument();
    await user.click(screen.getByRole("menuitem", { name: "Controls" }));
    for (const name of ["Play", "Skip Back 10 Seconds", "Skip Forward 10 Seconds"]) {
      expect(unavailable(await screen.findByRole("menuitem", { name }))).toBe(true);
    }
    expect(unavailable(screen.getByRole("menuitem", { name: "Add to Watch Later" }))).toBe(false);
    // The player's own controls are dimmed too.
    await user.keyboard("{Escape}");
    const hud = screen.getByRole("group", { name: "Playback controls" });
    expect(unavailable(within(hud).getByRole("button", { name: "Play" }))).toBe(true);
  });
});
