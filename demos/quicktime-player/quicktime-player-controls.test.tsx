import { act, fireEvent, render, screen } from "@testing-library/react";
import { MenuItem } from "macalicious/menu-item";
import { afterEach, describe, expect, it, vi } from "vitest";
import { QuickTimePlayer } from "./quicktime-player";

/*
 * Test double: `session` stands in for the browser's navigator.mediaSession, which jsdom has none of.
 * The real element's frame steps and the controller's place in a browser are
 * e2e/quicktime-player-census-journey.mjs.
 */
const movie = (extra = {}) => (
  <QuickTimePlayer src="blob:movie" title="Holiday.webm" duration={0} frameRate={30} {...extra} />
);
const video = () => document.querySelector("video") as HTMLVideoElement;
const loaded = () => {
  vi.spyOn(HTMLMediaElement.prototype, "duration", "get").mockReturnValue(10);
  fireEvent.loadedMetadata(video());
};

afterEach(() => {
  vi.restoreAllMocks();
  Reflect.deleteProperty(navigator, "mediaSession");
});

describe("The arrow keys", () => {
  it("step a frame with the focus on a controller's button, not on a slider", () => {
    render(movie());
    loaded();
    const elapsed = () => document.querySelector("[data-time='elapsed']")?.textContent;
    expect(elapsed()).toBe("00:00:00:00");
    fireEvent.keyDown(screen.getByRole("button", { name: "Rewind" }), { key: "ArrowRight" });
    expect(elapsed()).toBe("00:00:00:01");
    fireEvent.keyDown(screen.getByRole("slider", { name: "Volume" }), { key: "ArrowLeft" });
    expect(elapsed()).toBe("00:00:00:01");
  });

  it("keep the frame they stepped to when the element reports its time in whole microseconds", () => {
    render(movie());
    loaded();
    const elapsed = () => document.querySelector("[data-time='elapsed']")?.textContent;
    const button = screen.getByRole("button", { name: "Rewind" });
    for (const [time, code] of [
      [0.033333, "00:00:00:01"],
      [0.066667, "00:00:00:02"],
    ] as const) {
      fireEvent.keyDown(button, { key: "ArrowRight" });
      Object.defineProperty(video(), "currentTime", {
        configurable: true,
        get: () => time,
        set: () => {},
      });
      fireEvent.seeked(video());
      expect(elapsed()).toBe(code);
    }
  });
});

describe("The controller", () => {
  it("moves with a drag on its background, held inside the window by the stylesheet's hooks", () => {
    render(movie());
    const hud = screen.getByRole("group", { name: "Playback controls" });
    const place = hud.parentElement as HTMLElement;
    fireEvent.pointerDown(hud, { button: 0, clientX: 100, clientY: 100 });
    fireEvent.pointerMove(window, { clientX: 130, clientY: 60 });
    expect(place.style.getPropertyValue("--mac-quicktime-player-controller-shift")).toContain(
      "30px",
    );
    expect(place.style.getPropertyValue("--mac-quicktime-player-controller-bottom")).toContain(
      "40px",
    );
    fireEvent.pointerUp(window);
    fireEvent.pointerMove(window, { clientX: 500, clientY: 500 });
    expect(place.style.getPropertyValue("--mac-quicktime-player-controller-shift")).toContain(
      "30px",
    );
  });

  it("does not move from a press on one of its controls", () => {
    render(movie());
    const hud = screen.getByRole("group", { name: "Playback controls" });
    fireEvent.pointerDown(screen.getByRole("button", { name: "Mute" }), {
      button: 0,
      clientX: 100,
      clientY: 100,
    });
    fireEvent.pointerMove(window, { clientX: 130, clientY: 60 });
    expect(hud.parentElement?.getAttribute("style")).toBeNull();
  });
});

describe("The media keys", () => {
  const session = () => {
    const handlers = new Map<string, MediaSessionActionHandler | null>();
    const stub = {
      metadata: null as unknown,
      playbackState: "none",
      handlers,
      setActionHandler: (action: string, handler: MediaSessionActionHandler | null) =>
        handlers.set(action, handler),
    };
    Object.defineProperty(navigator, "mediaSession", { configurable: true, value: stub });
    return stub;
  };

  it("reach the movie that plays, and let go when its window goes", async () => {
    const stub = session();
    vi.stubGlobal(
      "MediaMetadata",
      class {
        title: string;
        constructor({ title }: { title: string }) {
          this.title = title;
        }
      },
    );
    vi.spyOn(HTMLMediaElement.prototype, "play").mockResolvedValue();
    const seek = vi.spyOn(HTMLMediaElement.prototype, "currentTime", "set");
    const { unmount } = render(movie());
    loaded();
    expect(stub.handlers.size).toBe(0);
    fireEvent.click(screen.getByRole("button", { name: "Play" }));
    expect(stub.playbackState).toBe("playing");
    expect((stub.metadata as { title: string }).title).toBe("Holiday.webm");

    act(() => stub.handlers.get("seekto")?.({ action: "seekto", seekTime: 4 }));
    expect(seek).toHaveBeenLastCalledWith(4);
    act(() => stub.handlers.get("seekforward")?.({ action: "seekforward" }));
    expect(seek).toHaveBeenLastCalledWith(10);
    act(() => stub.handlers.get("pause")?.({ action: "pause" }));
    expect(screen.getByRole("button", { name: "Play" })).toBeInTheDocument();
    expect(stub.playbackState).toBe("paused");
    act(() => stub.handlers.get("play")?.({ action: "play" }));
    expect(screen.getByRole("button", { name: "Pause" })).toBeInTheDocument();

    unmount();
    expect(stub.handlers.get("play")).toBeNull();
    expect(stub.playbackState).toBe("none");
    expect(stub.metadata).toBeNull();
    vi.unstubAllGlobals();
  });
});

describe("The title bar", () => {
  it("opens the document's menu from the title, and still moves the window from a press on it", async () => {
    const drag = vi.fn();
    render(
      movie({
        titleMenu: <MenuItem>Rename…</MenuItem>,
        onDragRegionPointerDown: drag,
      }),
    );
    const title = screen.getByRole("button", { name: "Holiday.webm" });
    expect(screen.getByRole("region", { name: "Holiday.webm" })).toBeInTheDocument();
    fireEvent.pointerDown(title, { button: 0, clientX: 5, clientY: 5 });
    expect(drag).toHaveBeenCalledTimes(1);
    fireEvent.click(title, { clientX: 200, clientY: 5 });
    expect(screen.queryByRole("menuitem", { name: "Rename…" })).toBeNull();
    fireEvent.pointerDown(title, { button: 0, clientX: 5, clientY: 5 });
    fireEvent.click(title, { clientX: 5, clientY: 5 });
    expect(await screen.findByRole("menuitem", { name: "Rename…" })).toBeInTheDocument();
  });

  it("gives a press on the proxy icon to its handler and not to the window's drag", () => {
    const drag = vi.fn();
    const proxy = vi.fn();
    render(movie({ onDragRegionPointerDown: drag, onProxyPointerDown: proxy }));
    fireEvent.pointerDown(document.querySelector("[data-proxy-drag]") as Element, { button: 0 });
    expect(proxy).toHaveBeenCalledTimes(1);
    expect(drag).not.toHaveBeenCalled();
  });
});
