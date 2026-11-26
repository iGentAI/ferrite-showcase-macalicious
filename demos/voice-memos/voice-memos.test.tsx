import { act, fireEvent, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ManagedWindow } from "macalicious/managed-window";
import { WindowManager } from "macalicious/window-manager";
import { createRef } from "react";
import { hydrateRoot } from "react-dom/client";
import { renderToString } from "react-dom/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { app, voiceMemosApp } from "./app";
import { VoiceMemos } from "./voice-memos";
import { VoiceMemosApp } from "./voice-memos-app";

const frame = (title: string) => screen.getByRole("region", { name: title });
const button = (name: string) => screen.getByRole("button", { name });
/** The large timer's text: minutes, seconds and hundredths of the position. */
const timer = () => screen.getByRole("timer", { name: "Position" }).textContent;
const slider = () => screen.getByRole("slider", { name: "Recording position" });
/** A row of the list of recordings, by the title it starts with. */
const row = (title: RegExp) => screen.getByRole("option", { name: title });
const rows = () =>
  within(screen.getByRole("listbox", { name: "Recordings" })).getAllByRole("option");
/** The toolbar row: the window's drag region. */
const bar = (title: string) =>
  frame(title).querySelector("[data-window-drag-region]") as HTMLElement;

/**
 * The demo's clock is the browser's animation frames. The tests hold them: a frame runs only
 * when `frames` says so, and reports the time the test gives it.
 */
let pending: FrameRequestCallback[] = [];
let now = 0;

/** Runs one frame `milliseconds` after the last one. */
function nextFrame(milliseconds: number) {
  now += milliseconds;
  const due = pending;
  pending = [];
  act(() => {
    for (const callback of due) callback(now);
  });
}

/** Lets `seconds` pass, a twentieth of a second to a frame. */
function pass(seconds: number) {
  for (let frames = Math.round(seconds * 20); frames > 0; frames--) nextFrame(50);
}

beforeEach(() => {
  pending = [];
  now = 1000;
  vi.stubGlobal("requestAnimationFrame", (callback: FrameRequestCallback) => {
    pending.push(callback);
    return pending.length;
  });
  vi.stubGlobal("cancelAnimationFrame", () => {
    pending = [];
  });
});

afterEach(() => {
  vi.unstubAllGlobals();
});

/** Starts the clock of what was just pressed: its first frame only notes the time. */
async function press(user: ReturnType<typeof userEvent.setup>, name: string) {
  await user.click(button(name));
  nextFrame(0);
}

describe("Voice Memos", () => {
  it("opens on the recording of the reference capture, at its size", () => {
    render(<VoiceMemos />);
    const root = frame("New Recording 3");
    expect(root).toHaveClass("mac-window", "mac-voice-memos");
    expect(root).toHaveAttribute("data-window-state", "key");
    expect(root).toHaveStyle({ width: "789px", height: "630px" });
    expect(
      within(screen.getByRole("group", { name: "Window controls" })).getAllByRole("button"),
    ).toHaveLength(3);

    // The take of the capture: 3.095 s, the playhead at its end, the pill showing its pause.
    expect(timer()).toBe("00:03.09");
    expect(slider()).toHaveAttribute("max", "3.095");
    expect(slider()).toHaveAttribute("aria-valuetext", "00:03");
    expect(screen.getByRole("img", { name: "Waveform of New Recording 3" })).toBeInTheDocument();
    expect(button("Pause Recording")).toBeEnabled();
    expect(button("Play")).toBeEnabled();
    expect(button("Done")).toBeEnabled();
    // Trimming is not built: the button is there, as captured, and unavailable.
    expect(button("Trim")).toHaveAttribute("aria-disabled", "true");
    // The list of recordings is behind Done.
    expect(screen.queryByRole("listbox")).toBeNull();
    // Nothing moves until something is pressed.
    expect(pending).toHaveLength(0);
  });

  it("opens on the recording and in the view it is given", () => {
    const { unmount } = render(<VoiceMemos defaultRecordingId="new-recording-4" />);
    expect(frame("New Recording 4")).toBeInTheDocument();
    expect(timer()).toBe("00:03.06");
    unmount();

    // An id that no recording has: the first of the list.
    render(<VoiceMemos defaultRecordingId="missing" defaultView="library" />);
    expect(frame("New Recording 4")).toBeInTheDocument();
    expect(rows()).toHaveLength(6);
    // In the list the playhead starts at the beginning, and nothing is being recorded.
    expect(timer()).toBe("00:00.00");
    expect(screen.queryByRole("button", { name: /Recording$/ })).toBe(button("New Recording"));
  });

  it("shows the list behind Done and the chosen recording in the player", async () => {
    const user = userEvent.setup();
    render(<VoiceMemos />);
    await user.click(button("Done"));

    expect(rows().map((option) => option.getAttribute("aria-selected"))).toEqual([
      "false",
      "true",
      "false",
      "false",
      "false",
      "false",
    ]);
    expect(row(/^New Recording 3/)).toHaveTextContent("00:03");
    // The pill and Done belong to the editing view; the transport stays.
    expect(screen.queryByRole("button", { name: "Done" })).toBeNull();
    expect(screen.queryByRole("button", { name: "Pause Recording" })).toBeNull();
    expect(button("Play")).toBeEnabled();

    await user.click(row(/^Ideas for the Workshop/));
    expect(row(/^Ideas for the Workshop/)).toHaveAttribute("aria-selected", "true");
    // The title, the waveform, the length and the timer are the chosen recording's.
    expect(frame("Ideas for the Workshop")).toBeInTheDocument();
    expect(
      screen.getByRole("img", { name: "Waveform of Ideas for the Workshop" }),
    ).toBeInTheDocument();
    expect(slider()).toHaveAttribute("max", "47.3");
    expect(slider()).toHaveAttribute("aria-valuetext", "00:00");
    expect(timer()).toBe("00:00.00");

    // Edit opens it over the whole window, paused: the pill offers to resume the take.
    await user.click(button("Edit"));
    expect(screen.queryByRole("listbox")).toBeNull();
    expect(frame("Ideas for the Workshop")).toBeInTheDocument();
    expect(button("Resume Recording")).toHaveTextContent("Resume");
    expect(button("Done")).toBeEnabled();
  });

  it("plays and pauses: the button changes its name and the position advances", async () => {
    const user = userEvent.setup();
    render(<VoiceMemos defaultView="library" defaultRecordingId="workshop" />);
    expect(timer()).toBe("00:00.00");

    await press(user, "Play");
    expect(screen.queryByRole("button", { name: "Play" })).toBeNull();
    pass(1.5);
    expect(timer()).toBe("00:01.50");
    expect(slider()).toHaveAttribute("aria-valuetext", "00:01");

    await user.click(button("Pause"));
    expect(button("Play")).toBeEnabled();
    // Paused, the clock is stopped, not merely ignored.
    expect(pending).toHaveLength(0);
    expect(timer()).toBe("00:01.50");

    await press(user, "Play");
    pass(0.5);
    expect(timer()).toBe("00:02.00");
  });

  it("stops at the end of the recording, and plays from the start again", async () => {
    const user = userEvent.setup();
    render(<VoiceMemos />);
    // The capture's playhead is at the end: playing starts over, and ends the take.
    await press(user, "Play");
    expect(button("Resume Recording")).toBeEnabled();
    pass(1);
    expect(timer()).toBe("00:01.00");

    pass(3);
    expect(timer()).toBe("00:03.09");
    expect(button("Play")).toBeEnabled();
    expect(pending).toHaveLength(0);
  });

  it("skips 15 seconds either way, within the recording", async () => {
    const user = userEvent.setup();
    render(<VoiceMemos defaultView="library" defaultRecordingId="workshop" />);
    await user.click(button("Skip Forward 15 Seconds"));
    expect(timer()).toBe("00:15.00");
    await user.click(button("Skip Forward 15 Seconds"));
    await user.click(button("Skip Back 15 Seconds"));
    expect(timer()).toBe("00:15.00");
    await user.click(button("Skip Back 15 Seconds"));
    await user.click(button("Skip Back 15 Seconds"));
    expect(timer()).toBe("00:00.00");

    for (let presses = 0; presses < 4; presses++) {
      await user.click(button("Skip Forward 15 Seconds"));
    }
    expect(timer()).toBe("00:47.30");

    // A skip to the end ends playback; one within the recording does not.
    await user.click(button("Skip Back 15 Seconds"));
    await press(user, "Play");
    await user.click(button("Skip Back 15 Seconds"));
    expect(button("Pause")).toBeEnabled();
    await user.click(button("Skip Forward 15 Seconds"));
    await user.click(button("Skip Forward 15 Seconds"));
    expect(timer()).toBe("00:47.30");
    expect(button("Play")).toBeEnabled();
  });

  it("seeks from the overview's slider and by dragging the waveform", async () => {
    const user = userEvent.setup();
    render(<VoiceMemos />);
    // 77 pt are one second: a drag that far to the right goes one second back.
    const waveform = screen.getByRole("img", { name: "Waveform of New Recording 3" });
    fireEvent.pointerDown(waveform, { pointerId: 1, button: 0, clientX: 200 });
    fireEvent.pointerMove(waveform, { pointerId: 1, clientX: 277 });
    fireEvent.pointerUp(waveform, { pointerId: 1 });
    expect(timer()).toBe("00:02.09");
    // Moving the playhead by hand ends the take that was being made.
    expect(button("Resume Recording")).toBeEnabled();

    slider().focus();
    await user.keyboard("{Home}");
    expect(timer()).toBe("00:00.00");
    await user.keyboard("{ArrowRight}");
    expect(timer()).toBe("00:00.25");
  });

  it("pauses the take with the pill and resumes it: the recording grows", async () => {
    const user = userEvent.setup();
    render(<VoiceMemos />);
    await user.click(button("Pause Recording"));
    expect(button("Resume Recording")).toHaveTextContent("Resume");
    expect(timer()).toBe("00:03.09");
    expect(pending).toHaveLength(0);

    // Resumed from anywhere, the take goes on at the end of what is recorded.
    await user.click(button("Skip Back 15 Seconds"));
    await press(user, "Resume Recording");
    pass(2);
    expect(timer()).toBe("00:05.09");
    expect(Number(slider().getAttribute("max"))).toBeCloseTo(5.095, 6);
    expect(slider()).toHaveAttribute("aria-valuetext", "00:05");

    await user.click(button("Pause Recording"));
    expect(pending).toHaveLength(0);
    // What was recorded stays, and plays.
    await user.click(button("Done"));
    expect(row(/^New Recording 3/)).toHaveTextContent("00:05");
  });

  it("starts a new recording from the list, under the next free title", async () => {
    const user = userEvent.setup();
    render(<VoiceMemos defaultView="library" />);
    await press(user, "New Recording");
    // The take runs at once, in the editing view, from nothing.
    expect(frame("New Recording 5")).toBeInTheDocument();
    expect(button("Pause Recording")).toBeEnabled();
    expect(timer()).toBe("00:00.00");
    pass(1.2);
    expect(timer()).toBe("00:01.20");

    await user.click(button("Done"));
    expect(rows()).toHaveLength(7);
    expect(rows()[0]).toHaveTextContent(/^New Recording 5Today00:01$/);
    expect(rows()[0]).toHaveAttribute("aria-selected", "true");
    expect(button("Play")).toBeEnabled();
  });

  it("filters the list by title", async () => {
    const user = userEvent.setup();
    render(<VoiceMemos defaultView="library" />);
    await user.type(screen.getByRole("searchbox", { name: "Search recordings" }), "reh");
    expect(rows()).toHaveLength(1);
    expect(rows()[0]).toHaveTextContent("Rehearsal Room, Second Verse");
    // The recording shown stays, whether the list still has it or not.
    expect(frame("New Recording 3")).toBeInTheDocument();

    await user.type(screen.getByRole("searchbox", { name: "Search recordings" }), "xyz");
    expect(screen.queryByRole("listbox")).toBeNull();
    expect(screen.getByRole("status")).toHaveTextContent("No Results");
  });

  it("shows an empty window when it has no recordings, and records the first", async () => {
    const user = userEvent.setup();
    render(<VoiceMemos defaultRecordings={[]} />);
    expect(frame("Voice Memos")).toBeInTheDocument();
    expect(screen.getByRole("status")).toHaveTextContent("No Recordings");
    expect(button("Play")).toBeDisabled();
    expect(button("Edit")).toHaveAttribute("aria-disabled", "true");

    await press(user, "New Recording");
    expect(frame("New Recording")).toBeInTheDocument();
    expect(button("Pause Recording")).toBeEnabled();
  });

  it("keeps the overview of a recording of no length, with a slider that cannot be moved", () => {
    const nothing = { id: "nothing", title: "Nothing Yet", date: "Today", duration: 0 };
    render(<VoiceMemos defaultRecordings={[{ ...nothing, samples: [], seed: 1 }]} />);
    expect(frame("Nothing Yet")).toBeInTheDocument();
    expect(slider()).toBeDisabled();
    expect(timer()).toBe("00:00.00");
  });

  it("stops its clock when it is unmounted", async () => {
    const user = userEvent.setup();
    const { unmount } = render(<VoiceMemos />);
    await press(user, "Play");
    expect(pending).toHaveLength(1);
    unmount();
    expect(pending).toHaveLength(0);
  });

  it("renders the same on the server and in the browser", () => {
    const container = document.createElement("div");
    document.body.append(container);
    container.innerHTML = renderToString(<VoiceMemos />);
    const onRecoverableError = vi.fn();
    let root: ReturnType<typeof hydrateRoot> | undefined;
    act(() => {
      root = hydrateRoot(container, <VoiceMemos />, { onRecoverableError });
    });
    expect(onRecoverableError).not.toHaveBeenCalled();
    expect(within(container).getByRole("timer")).toHaveTextContent("00:03.09");
    act(() => root?.unmount());
    container.remove();
  });

  it("passes window props to its root", () => {
    const ref = createRef<HTMLDivElement>();
    const onPointerDown = vi.fn();
    render(
      <VoiceMemos
        ref={ref}
        state="inactive"
        width="100%"
        height={600}
        className="mine"
        style={{ left: 10 }}
        id="memos"
        onPointerDown={onPointerDown}
      />,
    );
    const root = frame("New Recording 3");
    expect(ref.current).toBe(root);
    expect(root).toHaveClass("mac-window", "mac-voice-memos", "mine");
    expect(root).toHaveAttribute("data-window-state", "inactive");
    expect(root).toHaveAttribute("id", "memos");
    expect(root).toHaveStyle({ width: "100%", height: "600px", left: "10px" });
    fireEvent.pointerDown(root);
    expect(onPointerDown).toHaveBeenCalledTimes(1);
  });

  it("hands the window controls their props", async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    const onMinimize = vi.fn();
    const onZoom = vi.fn();
    const { rerender } = render(
      <VoiceMemos onClose={onClose} onMinimize={onMinimize} onZoom={onZoom} zoomRole="zoom" />,
    );
    await user.click(button("Close"));
    await user.click(button("Minimize"));
    await user.click(button("Zoom"));
    expect(onClose).toHaveBeenCalledTimes(1);
    expect(onMinimize).toHaveBeenCalledTimes(1);
    expect(onZoom).toHaveBeenCalledTimes(1);
    // The window controls' props are not attributes of the window.
    expect(frame("New Recording 3")).not.toHaveAttribute("zoomrole");

    rerender(<VoiceMemos minimizeDisabled zoomDisabled />);
    expect(button("Minimize")).toBeDisabled();
    expect(button("Enter Full Screen")).toBeDisabled();
    expect(button("Close")).toBeEnabled();
  });

  it("reports a press and a double click on the toolbar row, its drag region", async () => {
    const user = userEvent.setup();
    const onDragRegionPointerDown = vi.fn();
    const onDragRegionDoubleClick = vi.fn();
    render(
      <VoiceMemos
        onDragRegionPointerDown={onDragRegionPointerDown}
        onDragRegionDoubleClick={onDragRegionDoubleClick}
      />,
    );
    const region = bar("New Recording 3");
    expect(region).toContainElement(button("Trim"));

    fireEvent.pointerDown(region, { button: 2 });
    expect(onDragRegionPointerDown).not.toHaveBeenCalled();
    fireEvent.pointerDown(region, { button: 0 });
    expect(onDragRegionPointerDown).toHaveBeenCalledTimes(1);

    // The content is not part of the drag region: a press on the waveform seeks.
    fireEvent.pointerDown(screen.getByRole("img", { name: /^Waveform/ }), { button: 0 });
    fireEvent.pointerDown(button("Done"), { button: 0 });
    expect(onDragRegionPointerDown).toHaveBeenCalledTimes(1);

    await user.dblClick(region);
    expect(onDragRegionDoubleClick).toHaveBeenCalledTimes(1);
  });

  it("is hosted by a managed window through the descriptor", async () => {
    const user = userEvent.setup();
    expect(app).toBe(voiceMemosApp);
    // The app on the desktop served by Ferrite; here, with no drive, it is this demo.
    expect(app).toMatchObject({
      id: "voice-memos",
      name: "Voice Memos",
      component: VoiceMemosApp,
      defaultSize: { width: 789, height: 630 },
      resizable: true,
    });
    expect(app.menus).toEqual(["Voice Memos", "File", "Edit", "View", "Window", "Help"]);

    render(
      <WindowManager style={{ height: 900 }}>
        <ManagedWindow
          id={app.id}
          title={app.name}
          resizable={app.resizable}
          minWidth={app.minSize.width}
          minHeight={app.minSize.height}
          defaultFrame={{ x: 20, y: 30, ...app.defaultSize }}
          render={(props) => <app.component {...props} />}
        />
      </WindowManager>,
    );
    const root = frame("New Recording 3");
    const host = root.parentElement as HTMLElement;
    expect(host).toHaveAttribute("data-window-id", "voice-memos");
    expect(host).toHaveStyle({ width: "789px", height: "630px" });
    // The manager sizes the wrapper; the window fills it.
    expect(root).toHaveStyle({ width: "100%", height: "100%" });
    expect(root).toHaveAttribute("data-window-state", "key");

    // The manager moves the window by its toolbar row.
    const region = bar("New Recording 3");
    const before = host.style.transform;
    fireEvent.pointerDown(region, { button: 0, pointerId: 1, clientX: 300, clientY: 20 });
    fireEvent.pointerMove(region, { pointerId: 1, clientX: 340, clientY: 50 });
    fireEvent.pointerUp(region, { pointerId: 1, clientX: 340, clientY: 50 });
    expect(host.style.transform).not.toBe(before);

    // The app still works in there.
    await user.click(button("Done"));
    await user.click(row(/^New Recording 2/));
    expect(frame("New Recording 2")).toBeInTheDocument();

    await user.click(button("Close"));
    expect(screen.queryByRole("region")).toBeNull();
  });
});
