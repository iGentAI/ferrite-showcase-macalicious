import { act, fireEvent, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { QuickTimePlayer } from "./quicktime-player";

/*
 * Test double: jsdom has no media pipeline, so `HTMLMediaElement`'s `play`, `pause`, `paused`
 * and `duration` are stubbed here to behave as a loaded movie of `LENGTH` seconds would, and
 * its events are sent by hand. Real decoding and playback in Chromium, Firefox and WebKit are
 * covered by e2e/tv-journey.mjs, not here.
 */
const LENGTH = 120;
const proto = HTMLMediaElement.prototype;
const saved = {
  play: Object.getOwnPropertyDescriptor(proto, "play"),
  pause: Object.getOwnPropertyDescriptor(proto, "pause"),
  paused: Object.getOwnPropertyDescriptor(proto, "paused"),
  duration: Object.getOwnPropertyDescriptor(proto, "duration"),
};
const stopped = new WeakMap<HTMLMediaElement, boolean>();

beforeEach(() => {
  Object.defineProperty(proto, "paused", {
    configurable: true,
    get(this: HTMLMediaElement) {
      return stopped.get(this) ?? true;
    },
  });
  Object.defineProperty(proto, "duration", { configurable: true, get: () => LENGTH });
  Object.defineProperty(proto, "play", {
    configurable: true,
    value: vi.fn(function (this: HTMLMediaElement) {
      stopped.set(this, false);
      this.dispatchEvent(new Event("play"));
      return Promise.resolve();
    }),
  });
  Object.defineProperty(proto, "pause", {
    configurable: true,
    value: vi.fn(function (this: HTMLMediaElement) {
      stopped.set(this, true);
      this.dispatchEvent(new Event("pause"));
    }),
  });
});

afterEach(() => {
  for (const [name, descriptor] of Object.entries(saved)) {
    if (descriptor) Object.defineProperty(proto, name, descriptor);
  }
  vi.unstubAllGlobals();
  Reflect.deleteProperty(document, "pictureInPictureEnabled");
});

const button = (name: string) => screen.getByRole("button", { name });
const movie = () => document.querySelector("video") as HTMLVideoElement;
const loaded = () => act(() => void movie().dispatchEvent(new Event("loadedmetadata")));

describe("QuickTimePlayer with a movie of its own (src)", () => {
  it("plays the movie in a video element, and its controller follows the movie", async () => {
    const user = userEvent.setup();
    const onTimeChange = vi.fn();
    render(<QuickTimePlayer src="blob:movie" title="Holiday.webm" onTimeChange={onTimeChange} />);
    expect(movie()).toHaveAttribute("src", "blob:movie");
    expect(screen.queryByRole("img", { name: /^A movie frame:/ })).toBeNull();
    loaded();
    // The movie's own length replaces the default one.
    expect(screen.getByText("00:02:00:00")).toBeInTheDocument();

    await user.click(button("Play"));
    expect(proto.play).toHaveBeenCalled();
    expect(button("Pause")).toBeInTheDocument();

    // The movie moves on by itself; the time code follows it.
    act(() => {
      movie().currentTime = 61;
      movie().dispatchEvent(new Event("timeupdate"));
    });
    expect(screen.getByText("00:01:01:00")).toBeInTheDocument();
    expect(onTimeChange).toHaveBeenLastCalledWith(61, LENGTH, true);

    await user.click(button("Pause"));
    expect(proto.pause).toHaveBeenCalled();
    expect(button("Play")).toBeInTheDocument();
  });

  it("seeks the movie with the timeline and the arrow keys, and sets its volume", async () => {
    const user = userEvent.setup();
    render(<QuickTimePlayer src="blob:movie" />);
    loaded();
    const timeline = screen.getByRole("slider", { name: "Timeline" });
    act(() => timeline.focus());
    await user.keyboard("{End}");
    expect(movie().currentTime).toBe(LENGTH);
    await user.keyboard("{Home}");
    expect(movie().currentTime).toBe(0);
    // An arrow key on the window steps a frame of the 30-frame time base.
    const window = screen.getByRole("region");
    act(() => window.focus());
    await user.keyboard("{ArrowRight}");
    expect(movie().currentTime).toBeCloseTo(1 / 30);

    await user.click(button("Mute"));
    expect(movie().muted).toBe(true);
    expect(movie().volume).toBe(0);
    await user.click(button("Full Volume"));
    expect(movie().muted).toBe(false);
    expect(movie().volume).toBe(1);
  });

  it("floats the movie in the browser's own Picture in Picture window where there is one", async () => {
    const user = userEvent.setup();
    Object.defineProperty(document, "pictureInPictureEnabled", { configurable: true, value: true });
    const request = vi.fn(async function (this: HTMLVideoElement) {
      this.dispatchEvent(new Event("enterpictureinpicture"));
      return {} as PictureInPictureWindow;
    });
    render(<QuickTimePlayer src="blob:movie" />);
    movie().requestPictureInPicture = request;
    await user.click(button("Picture in Picture"));
    expect(request).toHaveBeenCalled();
    expect(screen.getByText("This video is playing in Picture in Picture.")).toBeInTheDocument();
    // The movie stays where it is, playing, behind the note.
    expect(movie()).toBeInTheDocument();
    expect(button("Picture in Picture")).toHaveAttribute("aria-pressed", "true");
    act(() => void movie().dispatchEvent(new Event("leavepictureinpicture")));
    expect(screen.queryByText("This video is playing in Picture in Picture.")).toBeNull();
  });

  it("floats a live copy of the movie inside the window where the browser has no Picture in Picture", async () => {
    const user = userEvent.setup();
    render(<QuickTimePlayer src="blob:movie" />);
    await user.click(button("Picture in Picture"));
    const floating = screen.getByRole("group", { name: "Picture in Picture" });
    expect(floating.querySelector("canvas")).not.toBeNull();
    expect(movie()).toBeInTheDocument();
    await user.click(within(floating).getByRole("button", { name: "Return to Window" }));
    expect(screen.queryByRole("group", { name: "Picture in Picture" })).toBeNull();
  });

  it("copies the movie only once a frame is decoded, and goes on after a draw that fails", async () => {
    // Test doubles: animation frames run when the test says, and the canvas's 2D context is a
    // stand-in whose first draw throws as a browser's does for a frame it cannot draw yet.
    const frames: FrameRequestCallback[] = [];
    vi.stubGlobal("requestAnimationFrame", (callback: FrameRequestCallback) => {
      frames.push(callback);
      return frames.length;
    });
    vi.stubGlobal("cancelAnimationFrame", () => undefined);
    const drawImage = vi.fn().mockImplementationOnce(() => {
      throw new DOMException("not yet", "InvalidStateError");
    });
    const getContext = vi
      .spyOn(HTMLCanvasElement.prototype, "getContext")
      .mockReturnValue({ drawImage } as unknown as CanvasRenderingContext2D);
    try {
      const user = userEvent.setup();
      render(<QuickTimePlayer src="blob:movie" />);
      let ready = 1; // HAVE_METADATA: the size is known, no frame yet.
      Object.defineProperty(movie(), "readyState", { configurable: true, get: () => ready });
      Object.defineProperty(movie(), "videoWidth", { configurable: true, value: 320 });
      Object.defineProperty(movie(), "videoHeight", { configurable: true, value: 180 });
      await user.click(button("Picture in Picture"));
      const step = () =>
        act(() => {
          for (const run of frames.splice(0)) run(0);
        });
      step();
      expect(drawImage).not.toHaveBeenCalled();
      ready = 2; // HAVE_CURRENT_DATA.
      step(); // This draw throws…
      expect(drawImage).toHaveBeenCalledTimes(1);
      step(); // …and the copy carries on.
      expect(drawImage).toHaveBeenCalledTimes(2);
    } finally {
      getContext.mockRestore();
    }
  });

  it("fills the screen on a double click on the picture and on Control-Command-F", () => {
    const requestFullscreen = vi.fn(async () => {});
    render(<QuickTimePlayer src="blob:movie" />);
    const window = screen.getByRole("region");
    window.requestFullscreen = requestFullscreen;
    fireEvent.doubleClick(movie());
    expect(requestFullscreen).toHaveBeenCalledTimes(1);
    fireEvent.keyDown(window, { key: "f", ctrlKey: true, metaKey: true });
    expect(requestFullscreen).toHaveBeenCalledTimes(2);
  });

  it("goes on with another movie given as src as the one it replaced went, once it has loaded", async () => {
    const user = userEvent.setup();
    const { rerender } = render(<QuickTimePlayer src="blob:first" />);
    loaded();
    await user.click(button("Play"));
    act(() => {
      movie().currentTime = 40;
      movie().dispatchEvent(new Event("timeupdate"));
    });
    expect(button("Pause")).toBeInTheDocument();
    const plays = (proto.play as ReturnType<typeof vi.fn>).mock.calls.length;
    // A browser pauses a playing movie whose source is replaced.
    stopped.set(movie(), true);
    rerender(<QuickTimePlayer src="blob:second" />);
    expect(movie()).toHaveAttribute("src", "blob:second");
    // Until the new movie has loaded, nothing is asked of it: it starts at its beginning.
    expect((proto.play as ReturnType<typeof vi.fn>).mock.calls.length).toBe(plays);
    act(() => {
      movie().currentTime = 0;
    });
    loaded();
    expect(screen.getAllByText("00:00:00:00").length).toBeGreaterThan(0);
    // Loaded: it plays, as the movie it replaced did.
    expect((proto.play as ReturnType<typeof vi.fn>).mock.calls.length).toBe(plays + 1);
    expect(button("Pause")).toBeInTheDocument();
  });

  it("goes on playing through two sources given before the first has loaded", async () => {
    const user = userEvent.setup();
    const { rerender } = render(<QuickTimePlayer src="blob:first" />);
    loaded();
    await user.click(button("Fast Forward"));
    expect(movie().playbackRate).toBe(2);
    stopped.set(movie(), true);
    rerender(<QuickTimePlayer src="blob:second" />);
    // Replaced again before the second has loaded.
    rerender(<QuickTimePlayer src="blob:third" />);
    loaded();
    expect(movie()).toHaveAttribute("src", "blob:third");
    expect(movie().paused).toBe(false);
    expect(movie().playbackRate).toBe(2);
  });

  it("takes the end of the movie it shows, and no queued end of the movie it replaced", async () => {
    const user = userEvent.setup();
    let finished = false;
    const ended = Object.getOwnPropertyDescriptor(proto, "ended");
    Object.defineProperty(proto, "ended", { configurable: true, get: () => finished });
    try {
      const { rerender } = render(<QuickTimePlayer src="blob:first" />);
      loaded();
      await user.click(button("Play"));
      rerender(<QuickTimePlayer src="blob:second" />);
      // The old movie's `ended`, delivered while the new one loads and after it has resumed.
      act(() => void movie().dispatchEvent(new Event("ended")));
      loaded();
      expect(button("Pause")).toBeInTheDocument();
      act(() => void movie().dispatchEvent(new Event("ended")));
      expect(button("Pause")).toBeInTheDocument();
      // The new movie's own end stops the transport.
      act(() => {
        finished = true;
        stopped.set(movie(), true);
        movie().dispatchEvent(new Event("ended"));
      });
      expect(button("Play")).toBeInTheDocument();
    } finally {
      if (ended) Object.defineProperty(proto, "ended", ended);
      else Reflect.deleteProperty(proto, "ended");
    }
  });

  it("stops only for a play refused for the movie it is showing", async () => {
    const user = userEvent.setup();
    let refuse: (error: unknown) => void = () => {};
    render(<QuickTimePlayer src="blob:first" />);
    loaded();
    // A play the browser has not answered yet: it plays, then refuses.
    (proto.play as ReturnType<typeof vi.fn>).mockImplementationOnce(
      () =>
        new Promise((_resolve, reject) => {
          refuse = reject;
        }),
    );
    await user.click(button("Play"));
    expect(button("Pause")).toBeInTheDocument();
    // The element was given another source before the refusal came: it is not about that movie.
    movie().setAttribute("src", "blob:second");
    await act(async () => refuse(new DOMException("not allowed", "NotAllowedError")));
    expect(button("Pause")).toBeInTheDocument();
    movie().setAttribute("src", "blob:first");
    // A play cut short (a pause, a new load) is no refusal either.
    await user.click(button("Pause"));
    (proto.play as ReturnType<typeof vi.fn>).mockImplementationOnce(
      () =>
        new Promise((_resolve, reject) => {
          refuse = reject;
        }),
    );
    await user.click(button("Play"));
    await act(async () => refuse(new DOMException("interrupted", "AbortError")));
    expect(button("Pause")).toBeInTheDocument();
    // Refused for the movie it is showing: the transport stops.
    await user.click(button("Pause"));
    (proto.play as ReturnType<typeof vi.fn>).mockImplementationOnce(() =>
      Promise.reject(new DOMException("not allowed", "NotAllowedError")),
    );
    await user.click(button("Play"));
    await act(async () => {});
    expect(button("Play")).toBeInTheDocument();
  });

  it("takes no queued pause of the movie it replaces, before or after the new one has loaded", async () => {
    const user = userEvent.setup();
    const onTimeChange = vi.fn();
    const { rerender } = render(<QuickTimePlayer src="blob:first" onTimeChange={onTimeChange} />);
    loaded();
    await user.click(button("Play"));
    expect(button("Pause")).toBeInTheDocument();
    rerender(<QuickTimePlayer src="blob:second" onTimeChange={onTimeChange} />);
    // The browser's load of the new source pauses the element and queues `pause` for the old one.
    act(() => {
      stopped.set(movie(), true);
      movie().dispatchEvent(new Event("pause"));
    });
    loaded();
    // Loaded: it goes on playing, as the movie it replaced did.
    expect(movie().paused).toBe(false);
    expect(button("Pause")).toBeInTheDocument();
    onTimeChange.mockClear();
    // A queued `pause` delivered after the resume describes an element that is playing again.
    act(() => void movie().dispatchEvent(new Event("pause")));
    expect(button("Pause")).toBeInTheDocument();
    expect(onTimeChange).not.toHaveBeenCalledWith(expect.anything(), expect.anything(), false);
    // A real pause (the element paused, say from the browser's own controls) is still heard.
    act(() => {
      stopped.set(movie(), true);
      movie().dispatchEvent(new Event("pause"));
    });
    expect(button("Play")).toBeInTheDocument();
    expect(onTimeChange).toHaveBeenLastCalledWith(expect.any(Number), LENGTH, false);
  });

  it("tells the host a rewinding movie is moving, and that it stopped at the start", () => {
    vi.useFakeTimers();
    try {
      const onTimeChange = vi.fn();
      render(<QuickTimePlayer src="blob:movie" onTimeChange={onTimeChange} />);
      loaded();
      act(() => {
        movie().currentTime = 1;
        movie().dispatchEvent(new Event("timeupdate"));
      });
      fireEvent.click(button("Rewind"));
      expect(movie().paused).toBe(true);
      onTimeChange.mockClear();
      // A timeupdate of the paused element while it is moved back still says it is moving.
      act(() => void movie().dispatchEvent(new Event("timeupdate")));
      expect(onTimeChange).toHaveBeenLastCalledWith(expect.any(Number), LENGTH, true);
      act(() => void vi.advanceTimersByTime(200));
      expect(onTimeChange).toHaveBeenLastCalledWith(expect.any(Number), LENGTH, true);
      expect(onTimeChange.mock.lastCall?.[0]).toBeLessThan(1);
      // At the start the rewind stops, and the host hears that it stopped.
      act(() => void vi.advanceTimersByTime(1000));
      expect(onTimeChange).toHaveBeenLastCalledWith(0, LENGTH, false);
      expect(button("Play")).toBeInTheDocument();
    } finally {
      vi.useRealTimers();
    }
  });

  it("keeps the speed of a scanning movie for the movie that replaces it, and a paused one paused", async () => {
    const user = userEvent.setup();
    const { rerender } = render(<QuickTimePlayer src="blob:first" />);
    loaded();
    await user.click(button("Fast Forward"));
    expect(movie().playbackRate).toBe(2);
    stopped.set(movie(), true);
    rerender(<QuickTimePlayer src="blob:second" />);
    loaded();
    expect(movie().playbackRate).toBe(2);
    expect(movie().paused).toBe(false);

    // Paused, then replaced: the new movie waits for Play.
    await user.click(button("Play"));
    await user.click(button("Pause"));
    const plays = (proto.play as ReturnType<typeof vi.fn>).mock.calls.length;
    rerender(<QuickTimePlayer src="blob:third" />);
    loaded();
    expect((proto.play as ReturnType<typeof vi.fn>).mock.calls.length).toBe(plays);
    expect(button("Play")).toBeInTheDocument();
  });

  it("says so when the browser cannot play the movie", () => {
    render(<QuickTimePlayer src="blob:movie" />);
    Object.defineProperty(movie(), "error", { configurable: true, value: { code: 4 } });
    act(() => void movie().dispatchEvent(new Event("error")));
    expect(screen.getByText("This movie can’t be played in this browser.")).toBeInTheDocument();
  });

  it("stops the transport when the movie fails while it plays", async () => {
    const user = userEvent.setup();
    const onTimeChange = vi.fn();
    render(<QuickTimePlayer src="blob:movie" onTimeChange={onTimeChange} />);
    loaded();
    await user.click(button("Play"));
    expect(button("Pause")).toBeInTheDocument();
    act(() => {
      Object.defineProperty(movie(), "error", { configurable: true, value: { code: 3 } });
      movie().dispatchEvent(new Event("error"));
    });
    expect(button("Play")).toBeInTheDocument();
    expect(onTimeChange).toHaveBeenLastCalledWith(expect.any(Number), LENGTH, false);
  });

  it("takes no queued error of the movie it replaced", () => {
    const { rerender } = render(<QuickTimePlayer src="blob:first" />);
    rerender(<QuickTimePlayer src="blob:second" />);
    // The new load has cleared the element's error: this one was the old movie's.
    Object.defineProperty(movie(), "error", { configurable: true, value: null });
    act(() => void movie().dispatchEvent(new Event("error")));
    expect(screen.queryByText("This movie can’t be played in this browser.")).toBeNull();
  });

  it("keeps one movie element across renders, without re-rendering itself", () => {
    let renders = 0;
    const onTimeChange = () => {
      renders += 1;
    };
    const { rerender } = render(<QuickTimePlayer src="blob:movie" onTimeChange={onTimeChange} />);
    const first = movie();
    for (let n = 0; n < 5; n += 1) {
      rerender(<QuickTimePlayer src="blob:movie" onTimeChange={onTimeChange} />);
    }
    expect(movie()).toBe(first);
    // Re-renders by the host report nothing: no render loop set the movie going or moved it.
    expect(renders).toBe(0);
  });

  it("offers no invented AirPlay device for a real movie, and disables AirPlay without a picker", async () => {
    const user = userEvent.setup();
    render(<QuickTimePlayer src="blob:movie" />);
    loaded();
    const airPlay = button("AirPlay");
    expect(airPlay).toHaveAttribute("aria-disabled", "true");
    await user.click(airPlay);
    expect(screen.queryByRole("menuitemradio")).toBeNull();
    expect(screen.queryByText(/This video is playing on/)).toBeNull();
    expect(movie().parentElement).not.toHaveAttribute("data-elsewhere");
  });

  it("opens the browser's own picker of screens, and says when the movie plays on one", async () => {
    // Test double: jsdom has no Remote Playback API, so a `remote` object standing in for
    // Chromium's is put on the element; whether a real browser finds a screen is not tested.
    const playback = Object.assign(new EventTarget(), {
      state: "disconnected",
      prompt: vi.fn(() => Promise.resolve()),
    });
    Object.defineProperty(proto, "remote", { configurable: true, get: () => playback });
    try {
      const user = userEvent.setup();
      render(<QuickTimePlayer src="blob:movie" />);
      loaded();
      const airPlay = button("AirPlay");
      expect(airPlay).not.toHaveAttribute("aria-disabled", "true");
      await user.click(airPlay);
      expect(playback.prompt).toHaveBeenCalledTimes(1);
      expect(screen.queryByRole("menuitemradio")).toBeNull();

      act(() => {
        playback.state = "connected";
        playback.dispatchEvent(new Event("connect"));
      });
      expect(screen.getByText("This video is playing on another screen.")).toBeInTheDocument();
      expect(movie().parentElement).toHaveAttribute("data-elsewhere");

      act(() => {
        playback.state = "disconnected";
        playback.dispatchEvent(new Event("disconnect"));
      });
      expect(screen.queryByText("This video is playing on another screen.")).toBeNull();
    } finally {
      Reflect.deleteProperty(proto, "remote");
    }
  });
});
