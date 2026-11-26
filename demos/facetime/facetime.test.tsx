import { act, fireEvent, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ManagedWindow } from "macalicious/managed-window";
import { WindowManager } from "macalicious/window-manager";
import { createRef } from "react";
import { describe, expect, it, vi } from "vitest";
import { app, facetimeApp } from "./app";
import { FaceTime } from "./facetime";
import { CAMERA_PLACEHOLDER_DESCRIPTION } from "./facetime-artwork";
import {
  callDetail,
  describeList,
  type FaceTimeCall,
  filterCalls,
  kindName,
  RECENT_CALLS,
} from "./facetime-data";

const frame = () => screen.getByRole("region", { name: "FaceTime" });
const button = (name: string) => screen.getByRole("button", { name });
const tree = () => screen.getByRole("tree", { name: "Recent calls" });
const rows = () => within(tree()).queryAllByRole("treeitem");
const field = () => screen.getByRole("textbox", { name: "Recipient" });
const status = () => screen.getByRole("status");
const panel = () => screen.queryByRole("group", { name: "Call" });
/** The names in the list, top to bottom: a row's text is its name, then its detail line. */
const names = () =>
  rows().map((row) => (row.textContent ?? "").split(/(?:Missed )?FaceTime (?:Audio|Video)/)[0]);
const all = RECENT_CALLS.map((call) => call.name);

describe("FaceTime calls placed back and shown", () => {
  it("keeps whom a call dialled in its record when an uncontrolled call ends", async () => {
    const user = userEvent.setup();
    const onCallEnd = vi.fn();
    const martin: FaceTimeCall = {
      id: "m1",
      name: "Martin Example",
      kind: "video",
      status: "outgoing",
      when: "Yesterday",
      to: "martin",
    };
    render(<FaceTime defaultCalls={[martin]} onCallEnd={onCallEnd} />);
    await user.click(button(`Call Martin Example with ${kindName("video")}`));
    await user.click(button("End"));
    expect(onCallEnd.mock.calls[0]?.[0]).toMatchObject({ name: "Martin Example", to: "martin" });
  });

  it("never covers the people in a call with the camera placeholder", () => {
    const { rerender } = render(<FaceTime stage={<div data-testid="stage" />} />);
    expect(screen.getByTestId("stage")).toBeInTheDocument();
    expect(screen.queryByRole("img", { name: CAMERA_PLACEHOLDER_DESCRIPTION })).toBeNull();
    // With neither a call nor a preview of one's own, the placeholder stands in.
    rerender(<FaceTime />);
    expect(screen.getByRole("img", { name: CAMERA_PLACEHOLDER_DESCRIPTION })).toBeInTheDocument();
  });
});

describe("FaceTime data", () => {
  it("names the two kinds of call", () => {
    expect(kindName("audio")).toBe("FaceTime Audio");
    expect(kindName("video")).toBe("FaceTime Video");
  });

  it("keeps the order of the calls it filters", () => {
    expect(filterCalls(RECENT_CALLS, "all")).toEqual(RECENT_CALLS);
    expect(filterCalls(RECENT_CALLS, "missed").map((call) => call.id)).toEqual(["dario", "kofi"]);
    expect(filterCalls([], "missed")).toEqual([]);
  });

  it("says in words that a call was missed", () => {
    const call: FaceTimeCall = {
      id: "a",
      name: "Dario Venturi",
      kind: "audio",
      status: "missed",
      when: "Yesterday",
    };
    expect(callDetail(call)).toBe("Missed FaceTime Audio · Yesterday");
    expect(callDetail({ ...call, status: "incoming", kind: "video" })).toBe(
      "FaceTime Video · Yesterday",
    );
  });

  it("describes what a filter shows", () => {
    expect(describeList("all", 0)).toBe("No recent calls");
    expect(describeList("all", 1)).toBe("Showing 1 recent call");
    expect(describeList("all", 5)).toBe("Showing all 5 recent calls");
    expect(describeList("missed", 0)).toBe("No missed calls");
    expect(describeList("missed", 1)).toBe("Showing 1 missed call");
    expect(describeList("missed", 2)).toBe("Showing 2 missed calls");
  });
});

describe("FaceTime", () => {
  it("opens as the captures show it: All selected, an empty field, no calls", () => {
    render(<FaceTime />);
    expect(frame()).toHaveAttribute("data-appearance", "dark");
    expect(frame()).toHaveAttribute("data-window-state", "key");
    expect(within(frame()).getByRole("group", { name: "Calls shown" })).toBeInTheDocument();
    expect(button("All")).toHaveAttribute("aria-pressed", "true");
    expect(button("Missed")).toHaveAttribute("aria-pressed", "false");
    expect(field()).toHaveValue("");
    expect(field()).toHaveAttribute("placeholder", "Enter a name, email, or number");
    expect(rows()).toHaveLength(0);
    expect(screen.queryByRole("button", { name: "Audio" })).toBeNull();
    expect(screen.queryByRole("button", { name: "Video" })).toBeNull();
    expect(screen.getByRole("img", { name: /placeholder for the camera preview/ })).toBeVisible();
    expect(panel()).toBeNull();
    expect(status()).toBeEmptyDOMElement();
  });

  it("lists the calls it is given, with the missed ones marked in words", () => {
    render(<FaceTime defaultCalls={RECENT_CALLS} />);
    expect(names()).toEqual(all);
    const [first, second] = rows();
    expect(first).toHaveTextContent("FaceTime Video · 9:41 AM");
    expect(first).not.toHaveTextContent("Missed");
    expect(second).toHaveTextContent("Missed FaceTime Audio · Yesterday");
    // A row is named by its two lines, and not by the button at its end.
    expect(first).toHaveAccessibleName("Marit Solheim FaceTime Video · 9:41 AM");
    expect(second).toHaveAccessibleName("Dario Venturi Missed FaceTime Audio · Yesterday");
    // Every row has a button that calls back with the row's kind of call.
    for (const call of RECENT_CALLS) {
      expect(button(`Call ${call.name} with ${kindName(call.kind)}`)).toBeEnabled();
    }
  });

  it("filters the list with All and Missed, and says what is shown", async () => {
    const user = userEvent.setup();
    render(<FaceTime defaultCalls={RECENT_CALLS} />);
    await user.click(button("Missed"));
    expect(button("Missed")).toHaveAttribute("aria-pressed", "true");
    expect(button("All")).toHaveAttribute("aria-pressed", "false");
    expect(names()).toEqual(["Dario Venturi", "Kofi Asante"]);
    expect(status()).toHaveTextContent("Showing 2 missed calls");
    // The selected segment stays selected when it is clicked again.
    await user.click(button("Missed"));
    expect(button("Missed")).toHaveAttribute("aria-pressed", "true");
    expect(names()).toHaveLength(2);
    await user.click(button("All"));
    expect(names()).toEqual(all);
    expect(status()).toHaveTextContent("Showing all 5 recent calls");
  });

  it("filters from the keyboard: the arrow keys move between the segments", async () => {
    const user = userEvent.setup();
    render(<FaceTime defaultCalls={RECENT_CALLS} />);
    act(() => button("All").focus());
    await user.keyboard("{ArrowRight}");
    expect(button("Missed")).toHaveFocus();
    await user.keyboard(" ");
    expect(names()).toEqual(["Dario Venturi", "Kofi Asante"]);
    await user.keyboard("{ArrowLeft}{Enter}");
    expect(button("All")).toHaveFocus();
    expect(names()).toEqual(all);
  });

  it("opens on the filter and with the recipient it is given", () => {
    render(
      <FaceTime defaultCalls={RECENT_CALLS} defaultFilter="missed" defaultRecipient="Quinn" />,
    );
    expect(button("Missed")).toHaveAttribute("aria-pressed", "true");
    expect(names()).toEqual(["Dario Venturi", "Kofi Asante"]);
    expect(field()).toHaveValue("Quinn");
    expect(button("Audio")).toBeEnabled();
  });

  it("says so when no call was missed", async () => {
    const user = userEvent.setup();
    render(<FaceTime />);
    await user.click(button("Missed"));
    expect(rows()).toHaveLength(0);
    expect(status()).toHaveTextContent("No missed calls");
    await user.click(button("All"));
    expect(status()).toHaveTextContent("No recent calls");
  });

  it("offers Audio and Video once a recipient is typed, and not for spaces", async () => {
    const user = userEvent.setup();
    render(<FaceTime />);
    await user.type(field(), "   ");
    expect(screen.queryByRole("button", { name: "Audio" })).toBeNull();
    await user.type(field(), "Quinn Abara");
    const offer = screen.getByRole("group", { name: "Call Quinn Abara" });
    expect(within(offer).getByRole("button", { name: "Audio" })).toBeEnabled();
    expect(within(offer).getByRole("button", { name: "Video" })).toBeEnabled();
    await user.clear(field());
    expect(screen.queryByRole("button", { name: "Audio" })).toBeNull();
    expect(screen.queryByRole("button", { name: "Video" })).toBeNull();
  });

  it("places an audio call from the field, shows it over the preview and records it", async () => {
    const user = userEvent.setup();
    const onCallStart = vi.fn();
    const onCallEnd = vi.fn();
    render(
      <FaceTime defaultCalls={RECENT_CALLS} onCallStart={onCallStart} onCallEnd={onCallEnd} />,
    );
    await user.type(field(), " Quinn Abara ");
    await user.click(button("Audio"));

    expect(onCallStart).toHaveBeenCalledExactlyOnceWith({ name: "Quinn Abara", kind: "audio" });
    const call = panel() as HTMLElement;
    expect(call).toHaveTextContent("Quinn Abara");
    expect(call).toHaveTextContent("FaceTime Audio · Calling…");
    expect(status()).toHaveTextContent("Calling Quinn Abara with FaceTime Audio");
    // The field is emptied, so its two buttons are gone, and the keyboard is on End.
    expect(field()).toHaveValue("");
    expect(screen.queryByRole("button", { name: "Audio" })).toBeNull();
    expect(within(call).getByRole("button", { name: "End" })).toHaveFocus();
    // The call is not in the list until it has ended.
    expect(names()).toEqual(all);
    expect(onCallEnd).not.toHaveBeenCalled();

    await user.click(button("End"));
    expect(panel()).toBeNull();
    expect(names()).toEqual(["Quinn Abara", ...all]);
    expect(rows()[0]).toHaveTextContent(/^Quinn AbaraFaceTime Audio · \d{1,2}:\d{2}\s[AP]M$/);
    expect(status()).toHaveTextContent("Call with Quinn Abara ended");
    expect(field()).toHaveFocus();
    expect(onCallEnd).toHaveBeenCalledTimes(1);
    expect(onCallEnd.mock.calls[0]?.[0]).toMatchObject({
      name: "Quinn Abara",
      kind: "audio",
      status: "outgoing",
    });
    // The new line can be called back like any other.
    expect(button("Call Quinn Abara with FaceTime Audio")).toBeEnabled();
  });

  it("places a video call with the Video button", async () => {
    const user = userEvent.setup();
    const onCallStart = vi.fn();
    render(<FaceTime onCallStart={onCallStart} />);
    await user.type(field(), "quinn@example.com");
    await user.click(button("Video"));
    expect(onCallStart).toHaveBeenCalledExactlyOnceWith({
      name: "quinn@example.com",
      kind: "video",
    });
    expect(panel()).toHaveTextContent("FaceTime Video · Calling…");
    await user.click(button("End"));
    expect(rows()[0]).toHaveTextContent(/^quinn@example\.comFaceTime Video/);
  });

  it("works from the keyboard alone: Return calls, Space on End hangs up", async () => {
    const user = userEvent.setup();
    render(<FaceTime />);
    act(() => field().focus());
    // Return in an empty field does nothing.
    await user.keyboard("{Enter}");
    expect(panel()).toBeNull();
    await user.keyboard("Quinn Abara{Enter}");
    expect(panel()).toHaveTextContent("FaceTime Video · Calling…");
    expect(button("End")).toHaveFocus();
    await user.keyboard(" ");
    expect(panel()).toBeNull();
    expect(names()).toEqual(["Quinn Abara"]);
    expect(field()).toHaveFocus();
    // The Audio button is reached with Tab, past the list and the new row's button.
    await user.keyboard("Rae Okoro");
    await user.tab();
    expect(tree()).toHaveFocus();
    await user.tab();
    expect(button("Call Quinn Abara with FaceTime Video")).toHaveFocus();
    await user.tab();
    expect(button("Audio")).toHaveFocus();
    await user.keyboard("{Enter}");
    expect(panel()).toHaveTextContent("Rae Okoro");
    expect(panel()).toHaveTextContent("FaceTime Audio");
  });

  it("leaves a Return that confirms an input method's composition to the composition", async () => {
    const user = userEvent.setup();
    const onCallStart = vi.fn();
    render(<FaceTime onCallStart={onCallStart} />);
    await user.type(field(), "Quinn Abara");
    fireEvent.keyDown(field(), { key: "Enter", isComposing: true });
    expect(onCallStart).not.toHaveBeenCalled();
    // A Return an input method reports by keyCode 229 alone is the composition's too.
    fireEvent.keyDown(field(), { key: "Enter", keyCode: 229 });
    expect(onCallStart).not.toHaveBeenCalled();
    expect(panel()).toBeNull();
    expect(field()).toHaveValue("Quinn Abara");
    // The next Return, with nothing being composed, calls.
    fireEvent.keyDown(field(), { key: "Enter" });
    expect(onCallStart).toHaveBeenCalledExactlyOnceWith({ name: "Quinn Abara", kind: "video" });
  });

  it("gives a call placed here an id that no call of the list has", async () => {
    const user = userEvent.setup();
    const ended: string[] = [];
    // A list that holds the ids the first two calls placed here would be given.
    const taken = RECENT_CALLS.slice(0, 2).map((item, index) => ({
      ...item,
      id: `placed-${index + 1}`,
    }));
    render(<FaceTime defaultCalls={taken} onCallEnd={(record) => ended.push(record.id)} />);
    for (const name of ["Quinn Abara", "Rae Okoro"]) {
      await user.type(field(), `${name}{Enter}`);
      await user.click(button("End"));
    }
    expect(ended).toEqual(["placed-3", "placed-4"]);
    expect(rows()).toHaveLength(4);
    expect(names()).toEqual(["Rae Okoro", "Quinn Abara", ...taken.map((item) => item.name)]);
  });

  it("calls back from a recent call with the button of its row", async () => {
    const user = userEvent.setup();
    const onCallStart = vi.fn();
    render(<FaceTime defaultCalls={RECENT_CALLS} onCallStart={onCallStart} />);
    await user.click(button("Call Dario Venturi with FaceTime Audio"));
    expect(onCallStart).toHaveBeenCalledExactlyOnceWith({ name: "Dario Venturi", kind: "audio" });
    expect(panel()).toHaveTextContent("Dario Venturi");
    expect(button("End")).toHaveFocus();
    // No other call can be started while this one is under way.
    expect(button("Call Marit Solheim with FaceTime Video")).toBeDisabled();
    expect(button("Call Dario Venturi with FaceTime Audio")).toBeDisabled();

    await user.click(button("End"));
    // The call back is a new line at the top; the missed call stays where it was.
    expect(names()).toEqual(["Dario Venturi", ...all]);
    expect(rows()[0]).not.toHaveTextContent("Missed");
    expect(rows()[2]).toHaveTextContent("Missed FaceTime Audio · Yesterday");
    expect(
      screen.getAllByRole("button", { name: "Call Dario Venturi with FaceTime Audio" }),
    ).toHaveLength(2);
    await user.click(button("Missed"));
    expect(names()).toEqual(["Dario Venturi", "Kofi Asante"]);
  });

  it("selects a row with the arrow keys and calls it back with Return", async () => {
    const user = userEvent.setup();
    const onCallStart = vi.fn();
    render(<FaceTime defaultCalls={RECENT_CALLS} onCallStart={onCallStart} />);
    act(() => tree().focus());
    // Return with no row selected does nothing.
    await user.keyboard("{Enter}");
    expect(onCallStart).not.toHaveBeenCalled();
    await user.keyboard("{ArrowDown}{ArrowDown}{ArrowDown}");
    expect(rows()[2]).toHaveAttribute("aria-selected", "true");
    await user.keyboard("{Enter}");
    expect(onCallStart).toHaveBeenCalledExactlyOnceWith({ name: "Imogen Hartley", kind: "video" });
    expect(panel()).toHaveTextContent("Imogen Hartley");
  });

  it("selects a row with a press, and a press on its button does not select it", async () => {
    const user = userEvent.setup();
    render(<FaceTime defaultCalls={RECENT_CALLS} />);
    fireEvent.mouseDown(screen.getByText("Kofi Asante"));
    expect(rows()[3]).toHaveAttribute("aria-selected", "true");
    await user.click(button("Call Yuna Takeda with FaceTime Audio"));
    expect(rows()[3]).toHaveAttribute("aria-selected", "true");
    expect(rows()[4]).toHaveAttribute("aria-selected", "false");
    expect(panel()).toHaveTextContent("Yuna Takeda");
  });

  it("keeps one call at a time", async () => {
    const user = userEvent.setup();
    const onCallStart = vi.fn();
    render(<FaceTime defaultCalls={RECENT_CALLS} onCallStart={onCallStart} />);
    await user.type(field(), "Quinn Abara{Enter}");
    expect(onCallStart).toHaveBeenCalledTimes(1);
    // A second recipient can be typed, but neither Return nor the buttons call them yet.
    await user.type(field(), "Rae Okoro{Enter}");
    expect(button("Audio")).toBeDisabled();
    expect(button("Video")).toBeDisabled();
    act(() => tree().focus());
    await user.keyboard("{ArrowDown}{Enter}");
    expect(onCallStart).toHaveBeenCalledTimes(1);
    expect(panel()).toHaveTextContent("Quinn Abara");
    await user.click(button("End"));
    expect(button("Video")).toBeEnabled();
    await user.click(button("Video"));
    expect(panel()).toHaveTextContent("Rae Okoro");
    expect(onCallStart).toHaveBeenCalledTimes(2);
  });

  it("shows the caller's own picture instead of the placeholder", () => {
    render(
      <FaceTime>
        <video data-testid="camera" muted />
      </FaceTime>,
    );
    expect(screen.getByTestId("camera")).toBeInTheDocument();
    expect(screen.queryByRole("img")).toBeNull();
  });

  it("asks for no camera and no microphone", async () => {
    const user = userEvent.setup();
    const getUserMedia = vi.fn();
    vi.stubGlobal("navigator", { ...navigator, mediaDevices: { getUserMedia } });
    try {
      render(<FaceTime />);
      await user.type(field(), "Quinn Abara{Enter}");
      await user.click(button("End"));
      expect(getUserMedia).not.toHaveBeenCalled();
    } finally {
      vi.unstubAllGlobals();
    }
  });

  it("passes window props to the library window and the hosting callbacks to its parts", async () => {
    const user = userEvent.setup();
    const ref = createRef<HTMLDivElement>();
    const onClose = vi.fn();
    const onMinimize = vi.fn();
    const onZoom = vi.fn();
    const onDragRegionPointerDown = vi.fn();
    const onDragRegionDoubleClick = vi.fn();
    render(
      <FaceTime
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
      />,
    );
    expect(ref.current).toBe(frame());
    expect(frame()).toHaveClass("mac-window", "mac-facetime", "mine");
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

    // FaceTime has no title bar: the strip over the list is its drag region.
    const strip = frame().querySelector("[data-window-drag-region]") as HTMLElement;
    expect(strip).toContainElement(field());
    expect(strip).toContainElement(button("All"));
    fireEvent.pointerDown(strip, { button: 0 });
    fireEvent.doubleClick(strip);
    expect(onDragRegionPointerDown).toHaveBeenCalledTimes(1);
    expect(onDragRegionDoubleClick).toHaveBeenCalledTimes(1);
    // A press on a control in the strip is the control's, and another button does not drag.
    fireEvent.pointerDown(field(), { button: 0 });
    fireEvent.pointerDown(button("Missed"), { button: 0 });
    fireEvent.pointerDown(button("Close"), { button: 0 });
    fireEvent.pointerDown(strip, { button: 2 });
    fireEvent.doubleClick(field());
    expect(onDragRegionPointerDown).toHaveBeenCalledTimes(1);
    expect(onDragRegionDoubleClick).toHaveBeenCalledTimes(1);
  });

  it("disables the controls a host disables", () => {
    render(<FaceTime minimizeDisabled zoomDisabled />);
    expect(button("Minimize")).toBeDisabled();
    expect(button("Enter Full Screen")).toBeDisabled();
  });

  it("is hosted by a managed window through the descriptor", async () => {
    const user = userEvent.setup();
    expect(app).toBe(facetimeApp);
    expect(app).toMatchObject({
      id: "facetime",
      name: "FaceTime",
      defaultSize: { width: 652, height: 585 },
      resizable: true,
      menus: ["FaceTime", "File", "Edit", "Video", "Window", "Help"],
    });
    expect(app.minSize.width).toBeLessThan(app.defaultSize.width);
    expect(app.minSize.height).toBeLessThan(app.defaultSize.height);
    render(
      <WindowManager style={{ height: 700 }}>
        <ManagedWindow
          id={app.id}
          defaultFrame={{ x: 20, y: 20, ...app.defaultSize }}
          render={(props) => <app.component {...props} />}
        />
      </WindowManager>,
    );
    expect(frame()).toHaveAttribute("data-window-state", "key");
    expect(frame().parentElement).toHaveAttribute("data-window-id", "facetime");
    // A call works inside the managed window as it does alone.
    await user.type(within(frame()).getByRole("textbox", { name: "Recipient" }), "Quinn Abara");
    await user.click(within(frame()).getByRole("button", { name: "Video" }));
    expect(within(frame()).getByRole("group", { name: "Call" })).toHaveTextContent("Quinn Abara");
    await user.click(within(frame()).getByRole("button", { name: "End" }));
    expect(within(frame()).getAllByRole("treeitem")).toHaveLength(1);
    await user.click(within(frame()).getByRole("button", { name: "Close" }));
    expect(screen.queryByRole("region", { name: "FaceTime" })).toBeNull();
  });
});
