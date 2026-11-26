import { act, fireEvent, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ManagedWindow } from "macalicious/managed-window";
import { Window } from "macalicious/window";
import { WindowManager } from "macalicious/window-manager";
import { createRef } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { app, quicktimePlayerApp } from "./app";
import { QuickTimePlayer } from "./quicktime-player";
import { FloatsOnTop } from "./quicktime-player-app";
import {
  advance,
  createClock,
  fastForward,
  formatTimecode,
  parseTimecode,
  rewind,
  seek,
  step,
  toFrames,
  togglePlaying,
} from "./quicktime-player-clock";

const TITLE = "Untitled Movie";
const frame = () => screen.getByRole("region", { name: TITLE });
const button = (name: string) => screen.getByRole("button", { name });
const timeline = () => screen.getByRole("slider", { name: "Timeline" });
const volume = () => screen.getByRole("slider", { name: "Volume" });
/** The elapsed time code as the controller shows it. */
const elapsed = () => frame().querySelector("[data-time='elapsed']")?.textContent;
/** Let the simulated transport run for some milliseconds of fake time. */
const run = (milliseconds: number) => act(() => vi.advanceTimersByTime(milliseconds));
/** A click while the timers are faked: the user-event library waits on real ones. */
const click = (name: string) => fireEvent.click(button(name));

afterEach(() => {
  vi.useRealTimers();
});

describe("the clock", () => {
  it("writes a position as hours, minutes, seconds and frames", () => {
    expect(formatTimecode(0, 30)).toBe("00:00:00:00");
    expect(formatTimecode(5892, 30)).toBe("00:03:16:12");
    expect(formatTimecode(23092, 30)).toBe("00:12:49:22");
    // Between two frames the earlier one is shown; the timebase is whole.
    expect(formatTimecode(29.9, 30)).toBe("00:00:00:29");
    expect(formatTimecode(3600 * 24 + 23, 24)).toBe("01:00:00:23");
    expect(formatTimecode(-5, 30)).toBe("00:00:00:00");
  });

  it("reads a time code back, in its shorter forms too, and nothing else", () => {
    expect(parseTimecode("00:12:49:22", 30)).toBe(23092);
    expect(parseTimecode("03:16:12", 30)).toBe(5892);
    expect(parseTimecode("1:00", 25)).toBe(25);
    expect(parseTimecode("12", 25)).toBe(12);
    expect(parseTimecode("00:03:16.5", 30)).toBeUndefined();
    expect(parseTimecode("", 30)).toBeUndefined();
    expect(toFrames("00:00:02:00", 24)).toBe(48);
    expect(toFrames(90, 24)).toBe(90);
    expect(toFrames("soon", 24)).toBe(0);
    expect(toFrames(-3, 24)).toBe(0);
  });

  it("opens inside the movie, paused unless told to play", () => {
    expect(createClock({ duration: 100 })).toEqual({
      position: 0,
      duration: 100,
      frameRate: 30,
      playing: false,
      rate: 1,
    });
    expect(createClock({ duration: 100, position: 500 }).position).toBe(100);
    expect(createClock({ duration: 100, position: -1 }).position).toBe(0);
    expect(createClock({ duration: 100, position: 40, playing: true }).playing).toBe(true);
    // Nothing is left to play at the end.
    expect(createClock({ duration: 100, position: 100, playing: true }).playing).toBe(false);
  });

  it("moves only while it plays, a frame rate of frames a second", () => {
    const paused = createClock({ duration: 1000, position: 10, frameRate: 25 });
    expect(advance(paused, 5)).toBe(paused);
    const playing = togglePlaying(paused);
    expect(playing.playing).toBe(true);
    expect(advance(playing, 2).position).toBe(60);
    expect(advance(advance(playing, 0.04), 0.04).position).toBe(12);
    expect(togglePlaying(playing)).toMatchObject({ playing: false, position: 10 });
  });

  it("stops at the end, and plays from the start again after that", () => {
    const playing = togglePlaying(createClock({ duration: 100, position: 90, frameRate: 25 }));
    const ended = advance(playing, 10);
    expect(ended).toMatchObject({ position: 100, playing: false, rate: 1 });
    expect(togglePlaying(ended)).toMatchObject({ position: 0, playing: true });
  });

  it("steps the speed with every press of fast-forward, and round again", () => {
    let clock = createClock({ duration: 100000, position: 1000, frameRate: 25 });
    const rates = [];
    for (let press = 0; press < 6; press++) {
      clock = fastForward(clock);
      rates.push(clock.rate);
    }
    expect(rates).toEqual([2, 5, 10, 30, 60, 2]);
    expect(clock.playing).toBe(true);
    // 2x for a second is two seconds of the movie.
    expect(advance(clock, 1).position).toBe(1050);
    // The play button brings a scanning movie back to normal speed; it does not pause it.
    expect(togglePlaying(clock)).toMatchObject({ playing: true, rate: 1 });
    // At the end there is nothing to scan.
    const end = createClock({ duration: 100, position: 100 });
    expect(fastForward(end)).toBe(end);
  });

  it("rewinds through the same speeds and stops at the start", () => {
    let clock = createClock({ duration: 100000, position: 200, frameRate: 25 });
    clock = rewind(clock);
    expect(clock).toMatchObject({ playing: true, rate: -2 });
    expect(advance(clock, 1).position).toBe(150);
    expect(rewind(clock).rate).toBe(-5);
    // A change of direction starts at 2x again.
    expect(fastForward(rewind(clock)).rate).toBe(2);
    expect(advance(clock, 60)).toMatchObject({ position: 0, playing: false, rate: 1 });
    const start = createClock({ duration: 100 });
    expect(rewind(start)).toBe(start);
  });

  it("seeks within the movie and steps by whole frames", () => {
    const clock = togglePlaying(createClock({ duration: 100, position: 10.6 }));
    expect(seek(clock, 55)).toMatchObject({ position: 55, playing: true });
    expect(seek(clock, 1e6).position).toBe(100);
    expect(seek(clock, -4).position).toBe(0);
    expect(seek(clock, Number.NaN)).toBe(clock);
    expect(step(clock, 1)).toMatchObject({ position: 11, playing: false });
    expect(step(clock, -1)).toMatchObject({ position: 9, playing: false });
  });
});

describe("QuickTimePlayer", () => {
  it("opens paused at the start of the movie, dark in either appearance", () => {
    render(<QuickTimePlayer />);
    expect(frame()).toHaveClass("mac-window", "mac-quicktime-player");
    expect(frame()).toHaveAttribute("data-appearance", "dark");
    expect(frame()).toHaveAttribute("data-chrome", "shown");
    expect(frame().style.width).toBe("1470px");
    expect(frame().style.height).toBe("827px");
    expect(button("Play")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Pause" })).toBeNull();
    expect(elapsed()).toBe("00:00:00:00");
    expect(screen.getByText("00:12:49:22")).toBeInTheDocument();
    expect(timeline()).toHaveAttribute("aria-valuetext", "00:00:00:00 of 00:12:49:22");
    expect(volume()).toHaveValue("100");
    expect(within(frame()).getByRole("group", { name: "Playback controls" })).toBeInTheDocument();
    expect(screen.getByRole("img", { name: /^A movie frame:/ })).toBeInTheDocument();
  });

  it("takes the movie's name, length, frame rate and starting point", () => {
    render(
      <QuickTimePlayer
        title="Holiday"
        duration="00:01:00:00"
        defaultPosition={36}
        frameRate={24}
        defaultVolume={0.25}
      />,
    );
    expect(screen.getByRole("region", { name: "Holiday" })).toBeInTheDocument();
    expect(screen.getByText("00:00:01:12")).toBeInTheDocument();
    expect(timeline()).toHaveAttribute("aria-valuetext", "00:00:01:12 of 00:01:00:00");
    expect(timeline()).toHaveAttribute("max", "1440");
    expect(volume()).toHaveValue("25");
  });

  it("plays and pauses from its button, and time passes only while it plays", () => {
    vi.useFakeTimers();
    const onPlayingChange = vi.fn();
    render(<QuickTimePlayer frameRate={25} onPlayingChange={onPlayingChange} />);
    click("Play");
    expect(button("Pause")).toBeInTheDocument();
    expect(onPlayingChange).toHaveBeenLastCalledWith(true);
    run(2000);
    expect(elapsed()).toBe("00:00:02:00");
    expect(timeline()).toHaveValue("50");
    expect(timeline()).toHaveAttribute("aria-valuetext", "00:00:02:00 of 00:12:49:22");
    click("Pause");
    expect(button("Play")).toBeInTheDocument();
    expect(onPlayingChange).toHaveBeenLastCalledWith(false);
    run(5000);
    expect(elapsed()).toBe("00:00:02:00");
    expect(onPlayingChange).toHaveBeenCalledTimes(2);
  });

  it("plays as soon as it opens when asked to", () => {
    vi.useFakeTimers();
    render(<QuickTimePlayer frameRate={25} defaultPlaying />);
    expect(button("Pause")).toBeInTheDocument();
    run(1000);
    expect(elapsed()).toBe("00:00:01:00");
  });

  it("toggles with the space bar on the window, once, also from a control", async () => {
    const user = userEvent.setup();
    render(<QuickTimePlayer />);
    act(() => frame().focus());
    await user.keyboard(" ");
    expect(button("Pause")).toBeInTheDocument();
    await user.keyboard(" ");
    expect(button("Play")).toBeInTheDocument();
    // On the play button the key is the button's own: one press, one toggle.
    act(() => button("Play").focus());
    await user.keyboard(" ");
    expect(button("Pause")).toBeInTheDocument();
    // A slider has no use for the key, so the window takes it.
    act(() => timeline().focus());
    await user.keyboard(" ");
    expect(button("Play")).toBeInTheDocument();
  });

  it("steps a frame with the arrow keys on the window", async () => {
    const user = userEvent.setup();
    const onSeek = vi.fn();
    render(<QuickTimePlayer defaultPosition={100} onSeek={onSeek} />);
    act(() => frame().focus());
    await user.keyboard("{ArrowRight}{ArrowRight}");
    expect(elapsed()).toBe("00:00:03:12");
    expect(onSeek).toHaveBeenLastCalledWith(102);
    await user.keyboard("{ArrowLeft}");
    expect(elapsed()).toBe("00:00:03:11");
  });

  it("moves and pauses with J, K and L, and goes to the start and end with Option", async () => {
    const user = userEvent.setup();
    render(<QuickTimePlayer defaultPosition={100} />);
    const status = screen.getByRole("status");
    act(() => frame().focus());
    await user.keyboard("l");
    expect(status).toHaveTextContent("Fast forward 2×");
    await user.keyboard("l");
    expect(status).toHaveTextContent("Fast forward 5×");
    await user.keyboard("k");
    expect(status).toBeEmptyDOMElement();
    expect(button("Play")).toBeInTheDocument();
    await user.keyboard("j");
    expect(status).toHaveTextContent("Rewind 2×");
    await user.keyboard("k");
    await user.keyboard("{Alt>}{ArrowRight}{/Alt}");
    expect(elapsed()).toBe(frame().querySelector("[data-time='duration']")?.textContent);
    await user.keyboard("{Alt>}{ArrowLeft}{/Alt}");
    expect(elapsed()).toBe("00:00:00:00");
  });

  it("changes the volume with the Up and Down keys on the window", async () => {
    const user = userEvent.setup();
    render(<QuickTimePlayer />);
    act(() => frame().focus());
    await user.keyboard("{Alt>}{ArrowDown}{/Alt}");
    expect(volume()).toHaveValue("0");
    await user.keyboard("{ArrowUp}{ArrowUp}{ArrowUp}");
    expect(volume()).toHaveValue("30");
    await user.keyboard("{ArrowDown}");
    expect(volume()).toHaveValue("20");
    await user.keyboard("{Alt>}{ArrowUp}{/Alt}");
    expect(volume()).toHaveValue("100");
  });

  it("seeks with the timeline: its keys, and a change of its value", async () => {
    const user = userEvent.setup();
    const onSeek = vi.fn();
    render(<QuickTimePlayer onSeek={onSeek} />);
    act(() => timeline().focus());
    await user.keyboard("{ArrowRight}");
    expect(elapsed()).toBe("00:00:00:01");
    expect(onSeek).toHaveBeenLastCalledWith(1);
    // A large step is ten seconds.
    await user.keyboard("{PageUp}");
    expect(elapsed()).toBe("00:00:10:01");
    await user.keyboard("{End}");
    expect(elapsed()).toBe("00:12:49:22");
    await user.keyboard("{Home}");
    expect(elapsed()).toBe("00:00:00:00");
    fireEvent.change(timeline(), { target: { value: "5892" } });
    expect(elapsed()).toBe("00:03:16:12");
    expect(timeline()).toHaveAttribute("aria-valuetext", "00:03:16:12 of 00:12:49:22");
    expect(onSeek).toHaveBeenLastCalledWith(5892);
  });

  it("fast-forwards at 2x, then 5x, and returns to normal speed with Play", () => {
    vi.useFakeTimers();
    render(<QuickTimePlayer frameRate={25} />);
    const status = screen.getByRole("status");
    expect(status).toBeEmptyDOMElement();
    click("Fast Forward");
    expect(status).toHaveTextContent("Fast forward 2×");
    run(1000);
    expect(elapsed()).toBe("00:00:02:00");
    click("Fast Forward");
    expect(status).toHaveTextContent("Fast forward 5×");
    run(1000);
    expect(elapsed()).toBe("00:00:07:00");
    // While the movie scans, the middle button is Play: it goes back to normal speed.
    click("Play");
    expect(status).toBeEmptyDOMElement();
    expect(button("Pause")).toBeInTheDocument();
    run(1000);
    expect(elapsed()).toBe("00:00:08:00");
  });

  it("rewinds, and stops when it reaches the start", () => {
    vi.useFakeTimers();
    render(<QuickTimePlayer frameRate={25} defaultPosition="00:00:10:00" />);
    click("Rewind");
    expect(screen.getByRole("status")).toHaveTextContent("Rewind 2×");
    run(2000);
    expect(elapsed()).toBe("00:00:06:00");
    run(10_000);
    expect(elapsed()).toBe("00:00:00:00");
    expect(screen.getByRole("status")).toBeEmptyDOMElement();
    expect(button("Play")).toBeInTheDocument();
  });

  it("stops at the end of the movie and starts over on the next Play", () => {
    vi.useFakeTimers();
    const onPlayingChange = vi.fn();
    render(
      <QuickTimePlayer
        frameRate={25}
        duration="00:00:05:00"
        defaultPosition="00:00:04:00"
        onPlayingChange={onPlayingChange}
      />,
    );
    click("Play");
    run(3000);
    expect(elapsed()).toBe("00:00:05:00");
    expect(timeline()).toHaveValue("125");
    expect(button("Play")).toBeInTheDocument();
    expect(onPlayingChange).toHaveBeenLastCalledWith(false);
    click("Play");
    run(1000);
    expect(elapsed()).toBe("00:00:01:00");
  });

  it("changes the volume, mutes and unmutes, and goes to full volume", async () => {
    const user = userEvent.setup();
    const onVolumeLevelChange = vi.fn();
    render(<QuickTimePlayer defaultVolume={0.5} onVolumeLevelChange={onVolumeLevelChange} />);
    act(() => volume().focus());
    await user.keyboard("{ArrowRight}");
    expect(volume()).toHaveValue("51");
    expect(onVolumeLevelChange).toHaveBeenLastCalledWith(0.51);
    expect(button("Mute")).toHaveAttribute("aria-pressed", "false");
    await user.click(button("Mute"));
    expect(volume()).toHaveValue("0");
    expect(button("Mute")).toHaveAttribute("aria-pressed", "true");
    expect(onVolumeLevelChange).toHaveBeenLastCalledWith(0);
    // Pressed again, it gives back the volume it silenced.
    await user.click(button("Mute"));
    expect(volume()).toHaveValue("51");
    await user.click(button("Full Volume"));
    expect(volume()).toHaveValue("100");
    expect(onVolumeLevelChange).toHaveBeenLastCalledWith(1);
    fireEvent.change(volume(), { target: { value: "30" } });
    expect(volume()).toHaveValue("30");
    expect(onVolumeLevelChange).toHaveBeenLastCalledWith(0.3);
  });

  it("hides its bars after three seconds of playing untouched, and never while paused", () => {
    vi.useFakeTimers();
    render(<QuickTimePlayer frameRate={25} />);
    run(10_000);
    expect(frame()).toHaveAttribute("data-chrome", "shown");
    click("Play");
    run(2900);
    expect(frame()).toHaveAttribute("data-chrome", "shown");
    run(200);
    expect(frame()).toHaveAttribute("data-chrome", "hidden");
    // The pointer moving over the window brings them back, and the wait starts again.
    fireEvent.pointerMove(frame());
    expect(frame()).toHaveAttribute("data-chrome", "shown");
    run(3100);
    expect(frame()).toHaveAttribute("data-chrome", "hidden");
    // So does a key; pausing keeps them.
    fireEvent.keyDown(frame(), { key: " " });
    expect(button("Play")).toBeInTheDocument();
    expect(frame()).toHaveAttribute("data-chrome", "shown");
    run(10_000);
    expect(frame()).toHaveAttribute("data-chrome", "shown");
  });

  it("hides its bars as the pointer leaves a playing movie", () => {
    vi.useFakeTimers();
    render(<QuickTimePlayer frameRate={25} />);
    fireEvent.pointerLeave(frame());
    expect(frame()).toHaveAttribute("data-chrome", "shown");
    click("Play");
    fireEvent.pointerLeave(frame());
    expect(frame()).toHaveAttribute("data-chrome", "hidden");
  });

  it("opens the Share menu and keeps the bars while it is open", () => {
    vi.useFakeTimers();
    render(<QuickTimePlayer frameRate={25} defaultPlaying />);
    click("Share");
    run(100);
    const menu = screen.getByRole("menu");
    expect(
      within(menu)
        .getAllByRole("menuitem")
        .map((item) => item.textContent),
    ).toEqual(["Mail", "Messages", "AirDrop", "Notes"]);
    run(10_000);
    expect(frame()).toHaveAttribute("data-chrome", "shown");
  });

  it("sends the picture to another output from the AirPlay menu", async () => {
    const user = userEvent.setup();
    render(<QuickTimePlayer />);
    await user.click(button("AirPlay"));
    expect(await screen.findByRole("menuitemradio", { name: "This Computer" })).toBeChecked();
    await user.click(screen.getByRole("menuitemradio", { name: "Living Room" }));
    expect(screen.getByText("This video is playing on “Living Room”.")).toBeInTheDocument();
    expect(screen.queryByRole("img")).toBeNull();
  });

  it("floats the picture in a Picture in Picture window that plays and returns it", async () => {
    const user = userEvent.setup();
    render(<QuickTimePlayer />);
    expect(button("Picture in Picture")).toHaveAttribute("aria-pressed", "false");
    await user.click(button("Picture in Picture"));
    expect(button("Picture in Picture")).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByText("This video is playing in Picture in Picture.")).toBeInTheDocument();
    const floating = screen.getByRole("group", { name: "Picture in Picture" });
    // Its play button is the movie's: both now offer Pause.
    await user.click(within(floating).getByRole("button", { name: "Play" }));
    expect(screen.getAllByRole("button", { name: "Pause" })).toHaveLength(2);
    await user.click(within(floating).getByRole("button", { name: "Return to Window" }));
    expect(screen.queryByRole("group", { name: "Picture in Picture" })).toBeNull();
    expect(screen.getByRole("img", { name: /^A movie frame:/ })).toBeInTheDocument();
    expect(button("Picture in Picture")).toHaveAttribute("aria-pressed", "false");
  });

  it("shows a poster, or the caller's own movie, instead of the placeholder picture", () => {
    const { rerender } = render(<QuickTimePlayer poster={<img src="poster.png" alt="Poster" />} />);
    expect(screen.getByRole("img", { name: "Poster" })).toBeInTheDocument();
    expect(screen.queryByRole("img", { name: /^A movie frame:/ })).toBeNull();
    rerender(
      <QuickTimePlayer poster={<img src="poster.png" alt="Poster" />}>
        <video data-testid="movie" muted />
      </QuickTimePlayer>,
    );
    expect(screen.getByTestId("movie")).toBeInTheDocument();
    expect(screen.queryByRole("img")).toBeNull();
  });

  it("passes the window's props to the window and the manager's to its parts", async () => {
    const user = userEvent.setup();
    const ref = createRef<HTMLDivElement>();
    const onClose = vi.fn();
    const onMinimize = vi.fn();
    const onZoom = vi.fn();
    const onDragRegionPointerDown = vi.fn();
    const onDragRegionDoubleClick = vi.fn();
    const onKeyDown = vi.fn();
    render(
      <QuickTimePlayer
        ref={ref}
        state="inactive"
        width={700}
        height="50vh"
        className="mine"
        data-kind="app"
        style={{ left: 12 }}
        zoomRole="zoom"
        onClose={onClose}
        onMinimize={onMinimize}
        onZoom={onZoom}
        onDragRegionPointerDown={onDragRegionPointerDown}
        onDragRegionDoubleClick={onDragRegionDoubleClick}
        onKeyDown={onKeyDown}
      />,
    );
    expect(ref.current).toBe(frame());
    expect(frame()).toHaveClass("mac-window", "mac-quicktime-player", "mine");
    expect(frame()).toHaveAttribute("data-window-state", "inactive");
    expect(frame()).toHaveAttribute("data-kind", "app");
    expect(frame().style.width).toBe("700px");
    expect(frame().style.height).toBe("50vh");
    expect(frame().style.left).toBe("12px");

    await user.click(button("Close"));
    await user.click(button("Minimize"));
    await user.click(button("Zoom"));
    expect(onClose).toHaveBeenCalledTimes(1);
    expect(onMinimize).toHaveBeenCalledTimes(1);
    expect(onZoom).toHaveBeenCalledTimes(1);

    const title = screen.getByText(TITLE);
    fireEvent.pointerDown(title, { button: 0 });
    expect(onDragRegionPointerDown).toHaveBeenCalledTimes(1);
    fireEvent.doubleClick(title);
    expect(onDragRegionDoubleClick).toHaveBeenCalledTimes(1);
    // A press on a window control is the control's, not a drag.
    fireEvent.pointerDown(button("Close"), { button: 0 });
    expect(onDragRegionPointerDown).toHaveBeenCalledTimes(1);

    // The caller's own handler runs beside the window's.
    act(() => frame().focus());
    await user.keyboard(" ");
    expect(onKeyDown).toHaveBeenCalled();
    expect(button("Pause")).toBeInTheDocument();
  });

  it("disables the controls a host disables", () => {
    render(<QuickTimePlayer minimizeDisabled zoomDisabled />);
    expect(button("Minimize")).toBeDisabled();
    expect(button("Enter Full Screen")).toBeDisabled();
  });

  it("is hosted by a managed window through the descriptor: the Open panel, then the movie", () => {
    expect(app).toBe(quicktimePlayerApp);
    expect(app).toMatchObject({
      id: "quicktime-player",
      name: "QuickTime Player",
      defaultSize: { width: 1470, height: 827 },
      resizable: true,
      sizesItself: true,
      menus: ["QuickTime Player", "File", "Edit", "View", "Window", "Help"],
    });
    expect(app.minSize.width).toBeLessThan(app.defaultSize.width);
    expect(app.minSize.height).toBeLessThan(app.defaultSize.height);
    // jsdom has no object URLs: a stand-in address for the chosen file.
    const created = vi.fn(() => "blob:holiday");
    const revoked = vi.fn();
    Object.assign(URL, { createObjectURL: created, revokeObjectURL: revoked });
    const sizes: { width: number; height: number }[] = [];
    render(
      <WindowManager style={{ height: 900 }}>
        <ManagedWindow
          id={app.id}
          defaultFrame={{ x: 20, y: 20, ...app.defaultSize }}
          render={(props) => (
            <app.component
              {...props}
              served={false}
              onFrameSizeChange={(size) => sizes.push(size)}
            />
          )}
        />
      </WindowManager>,
    );
    const panel = screen.getByRole("region", { name: "Open" });
    expect(panel).toHaveAttribute("data-window-state", "key");
    expect(panel.parentElement).toHaveAttribute("data-window-id", "quicktime-player");
    expect(sizes.at(-1)).toEqual({ width: 760, height: 460 });

    // Without a drive, a file from the computer plays in the page alone.
    const movie = new File(["movie"], "Holiday.webm", { type: "video/webm" });
    fireEvent.change(screen.getByLabelText("Movie from this computer"), {
      target: { files: [movie] },
    });
    expect(created).toHaveBeenCalledWith(movie);
    const window = screen.getByRole("region", { name: "Holiday.webm" });
    expect(window.querySelector("video")).toHaveAttribute("src", "blob:holiday");
    expect(sizes.at(-1)).toEqual({ width: 1470, height: 827 });

    // Command-O goes back to the Open panel, and lets the movie's address go.
    fireEvent.keyDown(window, { key: "o", metaKey: true });
    expect(screen.getByRole("region", { name: "Open" })).toBeInTheDocument();
    expect(revoked).toHaveBeenCalledWith("blob:holiday");
  });

  it("floats its window over a newer one while FloatsOnTop is rendered, keeping the window's look", () => {
    const stage = (floats: boolean) => (
      <WindowManager style={{ height: 900 }}>
        <ManagedWindow
          id="movie"
          render={(props) => <Window {...props}>{floats ? <FloatsOnTop /> : null}</Window>}
        />
        <ManagedWindow id="finder" render={(props) => <Window {...props} />} />
      </WindowManager>
    );
    const layer = (id: string) =>
      Number((document.querySelector(`[data-window-id="${id}"]`) as HTMLElement).style.zIndex);
    const { rerender } = render(stage(false));
    expect(layer("movie")).toBeLessThan(layer("finder"));
    rerender(stage(true));
    expect(layer("movie")).toBeGreaterThan(layer("finder"));
    expect(layer("movie")).toBeLessThan(800);
    expect(document.querySelector('[data-window-id="movie"] .mac-window')).toHaveAttribute(
      "data-variant",
      "standard",
    );
    rerender(stage(false));
    expect(layer("movie")).toBeLessThan(layer("finder"));
  });
});
