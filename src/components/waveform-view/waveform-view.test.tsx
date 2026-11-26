import { DirectionProvider } from "@base-ui/react/direction-provider";
import { fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { createRef, useState } from "react";
import { describe, expect, it, vi } from "vitest";
import { WaveformView, WaveformViewDetail, WaveformViewOverview } from "./index";

const SAMPLES = Array.from({ length: 140 }, (_, i) => (i % 7) / 7);

function View(props: Partial<Parameters<typeof WaveformView>[0]>) {
  return (
    <WaveformView samples={SAMPLES} duration={7} aria-label="Memo" {...props}>
      <WaveformViewDetail data-testid="detail" />
      <WaveformViewOverview data-testid="overview" />
    </WaveformView>
  );
}

// First in the file: Base UI prints a warning once for each message, so a later test would
// not see one that an earlier render of an empty recording had already used up.
describe("WaveformViewOverview, empty recording", () => {
  it("is a disabled slider at its start, without a warning from Base UI", () => {
    const error = vi.spyOn(console, "error").mockImplementation(() => {});
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    try {
      render(
        <WaveformView samples={[]} duration={0}>
          <WaveformViewOverview />
        </WaveformView>,
      );
      expect(error).not.toHaveBeenCalled();
      expect(warn).not.toHaveBeenCalled();
    } finally {
      error.mockRestore();
      warn.mockRestore();
    }
    const slider = screen.getByRole("slider");
    expect(slider).toBeDisabled();
    expect(slider).toHaveValue("0");
    expect(slider).toHaveAttribute("aria-valuetext", "00:00");
    expect(screen.getAllByText("00:00")).toHaveLength(2);
  });
});

describe("WaveformView", () => {
  it("is a named group that passes props, className and ref to its root", () => {
    const ref = createRef<HTMLDivElement>();
    render(<View ref={ref} className="mine" id="memo" />);
    const group = screen.getByRole("group", { name: "Memo" });
    expect(ref.current).toBe(group);
    expect(group).toHaveClass("mac-waveform-view", "mine");
    expect(group).toHaveAttribute("id", "memo");
    expect(group).not.toHaveAttribute("data-disabled");
  });

  it("exposes one slider with the position, the duration and a value text", () => {
    render(<View defaultValue={3} />);
    const sliders = screen.getAllByRole("slider");
    expect(sliders).toHaveLength(1);
    const slider = screen.getByRole("slider", { name: "Recording position" });
    expect(slider).toHaveAttribute("min", "0");
    expect(slider).toHaveAttribute("max", "7");
    expect(slider).toHaveValue("3");
    expect(slider).toHaveAttribute("aria-valuetext", "00:03");
  });

  it("moves the position with the arrow keys, Page Up, Home and End", async () => {
    const user = userEvent.setup();
    const onValueChange = vi.fn();
    render(<View defaultValue={3} onValueChange={onValueChange} />);
    const slider = screen.getByRole("slider");
    await user.tab();
    expect(slider).toHaveFocus();
    await user.keyboard("{ArrowRight}");
    expect(onValueChange).toHaveBeenLastCalledWith(3.25);
    await user.keyboard("{ArrowLeft}{ArrowLeft}");
    expect(onValueChange).toHaveBeenLastCalledWith(2.75);
    await user.keyboard("{PageUp}");
    expect(onValueChange).toHaveBeenLastCalledWith(3.75);
    await user.keyboard("{Home}");
    expect(onValueChange).toHaveBeenLastCalledWith(0);
    await user.keyboard("{End}");
    expect(onValueChange).toHaveBeenLastCalledWith(7);
    expect(slider).toHaveValue("7");
  });

  it("uses the steps it is given", async () => {
    const user = userEvent.setup();
    const onValueChange = vi.fn();
    render(<View defaultValue={2} step={0.5} largeStep={2} onValueChange={onValueChange} />);
    await user.tab();
    await user.keyboard("{ArrowRight}");
    expect(onValueChange).toHaveBeenLastCalledWith(2.5);
    await user.keyboard("{PageUp}");
    expect(onValueChange).toHaveBeenLastCalledWith(4.5);
  });

  it("stays as given when controlled, and follows its owner", async () => {
    const user = userEvent.setup();
    function Owner() {
      const [position, setPosition] = useState(1);
      return (
        <>
          <WaveformView samples={SAMPLES} duration={7} value={2}>
            <WaveformViewOverview aria-label="Held" />
          </WaveformView>
          <WaveformView samples={SAMPLES} duration={7} value={position} onValueChange={setPosition}>
            <WaveformViewOverview aria-label="Owned" />
          </WaveformView>
        </>
      );
    }
    render(<Owner />);
    const held = screen.getByRole("slider", { name: "Held" });
    const owned = screen.getByRole("slider", { name: "Owned" });
    held.focus();
    await user.keyboard("{End}");
    expect(held).toHaveValue("2");
    owned.focus();
    await user.keyboard("{End}");
    expect(owned).toHaveValue("7");
  });

  it("keeps a position outside the recording within it", () => {
    render(<View value={99} />);
    expect(screen.getByRole("slider")).toHaveValue("7");
  });

  it("writes times with formatTime", () => {
    render(
      <WaveformView samples={SAMPLES} duration={90} defaultValue={61} formatTime={(s) => `${s}s`}>
        <WaveformViewDetail data-testid="detail" />
        <WaveformViewOverview data-testid="overview" />
      </WaveformView>,
    );
    expect(screen.getByRole("slider")).toHaveAttribute("aria-valuetext", "61s");
    expect(screen.getByTestId("overview")).toHaveTextContent("0s90s");
    expect(screen.getByTestId("detail")).toHaveTextContent("61s");
  });

  it("lets nothing change the position when disabled", async () => {
    const user = userEvent.setup();
    const onValueChange = vi.fn();
    render(<View defaultValue={3} disabled onValueChange={onValueChange} />);
    expect(screen.getByRole("group", { name: "Memo" })).toHaveAttribute("data-disabled", "");
    expect(screen.getByRole("slider")).toBeDisabled();
    const detail = screen.getByTestId("detail");
    fireEvent.pointerDown(detail, { pointerId: 1, button: 0, clientX: 200 });
    fireEvent.pointerMove(detail, { pointerId: 1, clientX: 100 });
    await user.tab();
    await user.keyboard("{End}");
    expect(onValueChange).not.toHaveBeenCalled();
  });

  it("refuses a part outside a WaveformView", () => {
    const error = vi.spyOn(console, "error").mockImplementation(() => {});
    expect(() => render(<WaveformViewDetail />)).toThrow(/inside a WaveformView/);
    expect(() => render(<WaveformViewOverview />)).toThrow(/inside a WaveformView/);
    error.mockRestore();
  });
});

describe("WaveformViewDetail", () => {
  it("is a picture named Waveform that takes no keyboard focus", () => {
    render(<View defaultValue={3} />);
    const detail = screen.getByRole("img", { name: "Waveform" });
    expect(detail).toBe(screen.getByTestId("detail"));
    expect(detail).not.toHaveAttribute("tabindex");
    expect(detail).toHaveTextContent("00:00");
    expect(detail).toHaveTextContent("00:07");
  });

  it("draws one bar every 4.15 pt of the recording at 77 pt a second", () => {
    render(<View />);
    const d = screen.getByTestId("detail").querySelector("path")?.getAttribute("d") ?? "";
    expect(d.match(/M/g)).toHaveLength(Math.ceil((7 * 77 - 0.75) / 4.15));
  });

  it("draws nothing for a recording without samples", () => {
    render(
      <WaveformView samples={[]} duration={7}>
        <WaveformViewDetail data-testid="detail" />
      </WaveformView>,
    );
    expect(screen.getByTestId("detail").querySelector("path")).toHaveAttribute("d", "");
  });

  it("seeks by a drag: 77 pt to the left is one second later", () => {
    const onValueChange = vi.fn();
    render(<View defaultValue={3} onValueChange={onValueChange} />);
    const detail = screen.getByTestId("detail");
    fireEvent.pointerDown(detail, { pointerId: 1, button: 0, clientX: 200 });
    fireEvent.pointerMove(detail, { pointerId: 1, clientX: 123 });
    expect(onValueChange).toHaveBeenLastCalledWith(4);
    fireEvent.pointerMove(detail, { pointerId: 2, clientX: 0 });
    expect(onValueChange).toHaveBeenCalledTimes(1);
    fireEvent.pointerMove(detail, { pointerId: 1, clientX: 2000 });
    expect(onValueChange).toHaveBeenLastCalledWith(0);
    fireEvent.pointerUp(detail, { pointerId: 1 });
    fireEvent.pointerMove(detail, { pointerId: 1, clientX: 100 });
    expect(onValueChange).toHaveBeenCalledTimes(2);
  });

  it("stops a drag when it is disabled while the pointer is down", () => {
    const onValueChange = vi.fn();
    const { rerender } = render(<View defaultValue={3} onValueChange={onValueChange} />);
    const detail = screen.getByTestId("detail");
    fireEvent.pointerDown(detail, { pointerId: 1, button: 0, clientX: 200 });
    rerender(<View defaultValue={3} onValueChange={onValueChange} disabled />);
    fireEvent.pointerMove(detail, { pointerId: 1, clientX: 123 });
    expect(onValueChange).not.toHaveBeenCalled();
    rerender(<View defaultValue={3} onValueChange={onValueChange} />);
    fireEvent.pointerMove(detail, { pointerId: 1, clientX: 123 });
    expect(onValueChange).not.toHaveBeenCalled();
  });

  it("follows one pointer: another press does not take the drag over or end it", () => {
    const onValueChange = vi.fn();
    render(<View defaultValue={3} onValueChange={onValueChange} />);
    const detail = screen.getByTestId("detail");
    fireEvent.pointerDown(detail, { pointerId: 1, button: 0, clientX: 200 });
    fireEvent.pointerDown(detail, { pointerId: 2, button: 0, clientX: 500 });
    fireEvent.pointerMove(detail, { pointerId: 2, clientX: 423 });
    expect(onValueChange).not.toHaveBeenCalled();
    fireEvent.pointerUp(detail, { pointerId: 2 });
    fireEvent.pointerCancel(detail, { pointerId: 2 });
    fireEvent.pointerMove(detail, { pointerId: 1, clientX: 123 });
    expect(onValueChange).toHaveBeenLastCalledWith(4);
  });

  it("ends the drag when the pointer's capture is lost", () => {
    const onValueChange = vi.fn();
    render(<View defaultValue={3} onValueChange={onValueChange} />);
    const detail = screen.getByTestId("detail");
    fireEvent.pointerDown(detail, { pointerId: 1, button: 0, clientX: 200 });
    fireEvent.lostPointerCapture(detail, { pointerId: 1 });
    fireEvent.pointerMove(detail, { pointerId: 1, clientX: 123 });
    expect(onValueChange).not.toHaveBeenCalled();
  });

  it("renders a bounded view for a duration, position or scale that is not finite or too small", () => {
    render(
      <>
        <WaveformView samples={SAMPLES} duration={Number.POSITIVE_INFINITY} value={1e300}>
          <WaveformViewDetail data-testid="endless" />
          <WaveformViewOverview aria-label="Endless" />
        </WaveformView>
        <WaveformView samples={SAMPLES} duration={7}>
          <WaveformViewDetail data-testid="tiny" scale={1e-9} />
          <WaveformViewDetail data-testid="huge" scale={Number.POSITIVE_INFINITY} />
        </WaveformView>
        <WaveformView samples={SAMPLES} duration={1e300} value={1e300}>
          <WaveformViewDetail data-testid="long" />
          <WaveformViewOverview aria-label="Long" />
        </WaveformView>
      </>,
    );
    expect(screen.getByRole("slider", { name: "Endless" })).toBeDisabled();
    expect(screen.getByRole("slider", { name: "Long" })).toHaveAttribute("max", "1000000");
    for (const id of ["endless", "tiny", "huge", "long"]) {
      const labels = screen.getByTestId(id).querySelectorAll(".mac-waveform-view-ruler-label");
      expect(labels.length).toBeGreaterThan(0);
      expect(labels.length).toBeLessThan(2000);
    }
  });

  it("follows the scale it is given", () => {
    const onValueChange = vi.fn();
    render(
      <WaveformView samples={SAMPLES} duration={7} defaultValue={3} onValueChange={onValueChange}>
        <WaveformViewDetail data-testid="detail" scale={40} />
      </WaveformView>,
    );
    const detail = screen.getByTestId("detail");
    fireEvent.pointerDown(detail, { pointerId: 1, button: 0, clientX: 200 });
    fireEvent.pointerMove(detail, { pointerId: 1, clientX: 160 });
    expect(onValueChange).toHaveBeenLastCalledWith(4);
  });

  it("draws a stretch of bounded width at any scale", () => {
    const hour = Array.from({ length: 72000 }, (_, i) => (i % 9) / 9);
    render(
      <WaveformView samples={hour} duration={3600} defaultValue={1800}>
        {[1, 77, 231, 500, 10000].map((scale) => (
          <WaveformViewDetail key={scale} data-testid={`at-${scale}`} scale={scale} />
        ))}
      </WaveformView>,
    );
    for (const scale of [1, 77, 231, 500, 10000]) {
      const detail = screen.getByTestId(`at-${scale}`);
      expect(Number(detail.querySelector("svg")?.getAttribute("width"))).toBeLessThan(2157);
      const d = detail.querySelector("path")?.getAttribute("d") ?? "";
      expect(d.match(/M/g)?.length).toBeLessThan(600);
      expect(detail).toHaveTextContent("30:00");
    }
  });

  it("leaves the position alone when the owner prevents a move's default", () => {
    const onValueChange = vi.fn();
    render(
      <WaveformView samples={SAMPLES} duration={7} defaultValue={3} onValueChange={onValueChange}>
        <WaveformViewDetail
          data-testid="detail"
          onPointerMove={(event) => event.preventDefault()}
        />
      </WaveformView>,
    );
    const detail = screen.getByTestId("detail");
    fireEvent.pointerDown(detail, { pointerId: 1, button: 0, clientX: 200 });
    fireEvent.pointerMove(detail, { pointerId: 1, clientX: 123 });
    expect(onValueChange).not.toHaveBeenCalled();
  });

  it("keeps a long recording's bars and labels near the playhead only", () => {
    const hour = Array.from({ length: 72000 }, (_, i) => (i % 9) / 9);
    render(
      <WaveformView samples={hour} duration={3600} defaultValue={1800}>
        <WaveformViewDetail data-testid="detail" />
      </WaveformView>,
    );
    const detail = screen.getByTestId("detail");
    expect(detail.querySelectorAll(".mac-waveform-view-ruler-label").length).toBeLessThan(40);
    const d = detail.querySelector("path")?.getAttribute("d") ?? "";
    expect(d.match(/M/g)?.length).toBeLessThan(600);
    expect(detail).toHaveTextContent("30:00");
    expect(detail).not.toHaveTextContent("00:00");
  });
});

describe("WaveformViewOverview", () => {
  it("shows the start and the end of the recording under the strip", () => {
    render(<View />);
    const labels = screen
      .getByTestId("overview")
      .querySelector(".mac-waveform-view-overview-labels");
    expect(labels).toHaveTextContent("00:0000:07");
    expect(labels).toHaveAttribute("aria-hidden", "true");
  });

  it("takes a name from aria-label or aria-labelledby", () => {
    render(
      <WaveformView samples={SAMPLES} duration={7}>
        <span id="name">Position in Memo</span>
        <WaveformViewOverview aria-labelledby="name" />
      </WaveformView>,
    );
    expect(screen.getByRole("slider", { name: "Position in Memo" })).toBeInTheDocument();
  });

  it("gives the recording the leading part of a strip that stands for more time", () => {
    render(
      <WaveformView samples={SAMPLES} duration={5}>
        <WaveformViewOverview data-testid="overview" span={20} />
      </WaveformView>,
    );
    const overview = screen.getByTestId("overview");
    expect(overview.querySelector(".mac-waveform-view-control")).toHaveStyle({ width: "25%" });
    const d = overview.querySelector("path")?.getAttribute("d") ?? "";
    expect(d.match(/M/g)).toHaveLength(78);
    expect(screen.getByRole("slider")).toHaveAttribute("max", "5");
  });

  it("runs from left to right under a right-to-left direction provider too", async () => {
    const user = userEvent.setup();
    const onValueChange = vi.fn();
    render(
      <DirectionProvider direction="rtl">
        <div dir="rtl">
          <View defaultValue={3} onValueChange={onValueChange} />
        </div>
      </DirectionProvider>,
    );
    await user.tab();
    await user.keyboard("{ArrowRight}");
    expect(onValueChange).toHaveBeenLastCalledWith(3.25);
    await user.keyboard("{ArrowLeft}{ArrowLeft}");
    expect(onValueChange).toHaveBeenLastCalledWith(2.75);
  });

  it("draws no bars for a recording without a duration, even with samples", () => {
    render(
      <WaveformView samples={SAMPLES} duration={0}>
        <WaveformViewDetail data-testid="detail" />
        <WaveformViewOverview data-testid="overview" />
      </WaveformView>,
    );
    expect(screen.getByTestId("overview").querySelector("path")).toHaveAttribute("d", "");
    expect(screen.getByTestId("detail").querySelector("path")).toHaveAttribute("d", "");
    expect(screen.getByRole("slider")).toBeDisabled();
  });

  it.each([2, Number.POSITIVE_INFINITY, Number.NaN])("ignores a span of %s", (span) => {
    render(
      <WaveformView samples={SAMPLES} duration={5}>
        <WaveformViewOverview data-testid="overview" span={span} />
      </WaveformView>,
    );
    const overview = screen.getByTestId("overview");
    expect(overview.querySelector(".mac-waveform-view-control")).toHaveStyle({ width: "100%" });
    expect(overview.querySelector("path")?.getAttribute("d")?.match(/M/g)).toHaveLength(310);
  });
});
