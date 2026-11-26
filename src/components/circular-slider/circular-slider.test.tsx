import { fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { createRef, useState } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { CircularSlider } from "./index";

/*
 * jsdom has neither layout nor pointer capture. For the pointer tests the dial gets the box a
 * 24 px dial at the page's origin would have, and the three pointer-capture methods get a
 * stand-in that records which pointer an element holds, as a browser would.
 */
const captured = new Map<Element, number>();
const prototype = Element.prototype as unknown as Record<string, unknown>;
const CAPTURE = ["setPointerCapture", "releasePointerCapture", "hasPointerCapture"];
// What the prototype had before, put back after each test (absent if it was absent).
const original = CAPTURE.map((name) => Object.getOwnPropertyDescriptor(prototype, name));

beforeEach(() => {
  prototype.setPointerCapture = function (this: Element, id: number) {
    captured.set(this, id);
  };
  prototype.releasePointerCapture = function (this: Element) {
    captured.delete(this);
  };
  prototype.hasPointerCapture = function (this: Element, id: number) {
    return captured.get(this) === id;
  };
});

afterEach(() => {
  captured.clear();
  CAPTURE.forEach((name, index) => {
    const descriptor = original[index];
    if (descriptor) Object.defineProperty(prototype, name, descriptor);
    else delete prototype[name];
  });
});

function layOut(dial: Element) {
  const box = { left: 0, top: 0, right: 24, bottom: 24, width: 24, height: 24, x: 0, y: 0 };
  vi.spyOn(dial, "getBoundingClientRect").mockReturnValue({ ...box, toJSON: () => box });
}

describe("CircularSlider", () => {
  it("renders a slider at its minimum, with its class and defaults", () => {
    render(<CircularSlider aria-label="Rotation" />);
    const dial = screen.getByRole("slider", { name: "Rotation" });
    expect(dial).toHaveClass("mac-circular-slider");
    expect(dial).toHaveAttribute("data-size", "regular");
    expect(dial).toHaveAttribute("aria-valuemin", "0");
    expect(dial).toHaveAttribute("aria-valuemax", "100");
    expect(dial).toHaveAttribute("aria-valuenow", "0");
    expect(dial).toHaveAttribute("tabindex", "0");
    expect(dial).not.toHaveAttribute("data-tick-marks");
  });

  it("reflects size, range and tick marks", () => {
    const { container } = render(
      <CircularSlider aria-label="Angle" size="small" min={-180} max={180} tickMarks={8} />,
    );
    const dial = screen.getByRole("slider");
    expect(dial).toHaveAttribute("data-size", "small");
    expect(dial).toHaveAttribute("aria-valuemin", "-180");
    expect(dial).toHaveAttribute("aria-valuemax", "180");
    expect(dial).toHaveAttribute("aria-valuenow", "-180");
    expect(dial).toHaveAttribute("data-tick-marks");
    expect(container.querySelectorAll(".mac-circular-slider-tick")).toHaveLength(8);
  });

  it("steps with the arrow keys and reports each change", async () => {
    const user = userEvent.setup();
    const onValueChange = vi.fn();
    const onValueCommitted = vi.fn();
    render(
      <CircularSlider
        aria-label="Rotation"
        defaultValue={50}
        onValueChange={onValueChange}
        onValueCommitted={onValueCommitted}
      />,
    );
    const dial = screen.getByRole("slider");

    await user.tab();
    expect(dial).toHaveFocus();
    await user.keyboard("{ArrowRight}");
    expect(dial).toHaveAttribute("aria-valuenow", "51");
    expect(onValueChange).toHaveBeenLastCalledWith(51);
    expect(onValueCommitted).toHaveBeenLastCalledWith(51);
    await user.keyboard("{ArrowUp}");
    expect(dial).toHaveAttribute("aria-valuenow", "52");
    await user.keyboard("{ArrowLeft}{ArrowDown}{ArrowDown}");
    expect(dial).toHaveAttribute("aria-valuenow", "49");
  });

  it("takes large steps with Page Up, Page Down and Shift, and jumps with Home and End", async () => {
    const user = userEvent.setup();
    render(<CircularSlider aria-label="Rotation" defaultValue={50} largeStep={20} />);
    const dial = screen.getByRole("slider");
    await user.tab();
    await user.keyboard("{PageUp}");
    expect(dial).toHaveAttribute("aria-valuenow", "70");
    await user.keyboard("{PageDown}{PageDown}");
    expect(dial).toHaveAttribute("aria-valuenow", "30");
    await user.keyboard("{Shift>}{ArrowRight}{/Shift}");
    expect(dial).toHaveAttribute("aria-valuenow", "50");
    await user.keyboard("{End}");
    expect(dial).toHaveAttribute("aria-valuenow", "100");
    await user.keyboard("{Home}");
    expect(dial).toHaveAttribute("aria-valuenow", "0");
  });

  it("wraps round at both ends", async () => {
    const user = userEvent.setup();
    render(<CircularSlider aria-label="Rotation" max={360} step={15} defaultValue={345} />);
    const dial = screen.getByRole("slider");
    await user.tab();
    await user.keyboard("{ArrowRight}");
    expect(dial).toHaveAttribute("aria-valuenow", "360");
    await user.keyboard("{ArrowRight}");
    expect(dial).toHaveAttribute("aria-valuenow", "15");
    await user.keyboard("{ArrowLeft}{ArrowLeft}");
    expect(dial).toHaveAttribute("aria-valuenow", "345");
  });

  it("moves from mark to mark with tickMarkValuesOnly", async () => {
    const user = userEvent.setup();
    render(<CircularSlider aria-label="Rotation" max={360} tickMarks={4} tickMarkValuesOnly />);
    const dial = screen.getByRole("slider");
    await user.tab();
    await user.keyboard("{ArrowRight}");
    expect(dial).toHaveAttribute("aria-valuenow", "90");
    await user.keyboard("{PageUp}");
    expect(dial).toHaveAttribute("aria-valuenow", "180");
  });

  it("follows the pointer round the dial while it is held", () => {
    const onValueChange = vi.fn();
    const onValueCommitted = vi.fn();
    render(
      <CircularSlider
        aria-label="Rotation"
        onValueChange={onValueChange}
        onValueCommitted={onValueCommitted}
      />,
    );
    const dial = screen.getByRole("slider");
    layOut(dial);

    // Not held yet: moving over the dial does nothing.
    fireEvent.pointerMove(dial, { clientX: 12, clientY: 24, pointerId: 1 });
    expect(dial).toHaveAttribute("aria-valuenow", "0");

    // Three o'clock is a quarter of the way round.
    fireEvent.pointerDown(dial, { button: 0, clientX: 24, clientY: 12, pointerId: 1 });
    expect(dial).toHaveAttribute("aria-valuenow", "25");
    expect(onValueChange).toHaveBeenLastCalledWith(25);

    // Six o'clock, then nine o'clock, also outside the dial.
    fireEvent.pointerMove(dial, { clientX: 12, clientY: 24, pointerId: 1 });
    expect(dial).toHaveAttribute("aria-valuenow", "50");
    fireEvent.pointerMove(dial, { clientX: -40, clientY: 12, pointerId: 1 });
    expect(dial).toHaveAttribute("aria-valuenow", "75");
    expect(onValueCommitted).not.toHaveBeenCalled();

    fireEvent.pointerUp(dial, { clientX: -40, clientY: 12, pointerId: 1 });
    expect(onValueCommitted).toHaveBeenLastCalledWith(75);

    // Released: the pointer no longer moves the value.
    fireEvent.pointerMove(dial, { clientX: 24, clientY: 12, pointerId: 1 });
    expect(dial).toHaveAttribute("aria-valuenow", "75");
  });

  it("ignores other mouse buttons", () => {
    render(<CircularSlider aria-label="Rotation" />);
    const dial = screen.getByRole("slider");
    layOut(dial);
    fireEvent.pointerDown(dial, { button: 2, clientX: 24, clientY: 12, pointerId: 1 });
    expect(dial).toHaveAttribute("aria-valuenow", "0");
  });

  it("follows the value prop when controlled", async () => {
    const user = userEvent.setup();
    function Controlled() {
      const [value, setValue] = useState(10);
      return (
        <CircularSlider
          aria-label="Capped"
          value={value}
          onValueChange={(next) => setValue(Math.min(next, 11))}
        />
      );
    }
    render(<Controlled />);
    const dial = screen.getByRole("slider");
    await user.tab();
    await user.keyboard("{ArrowRight}{ArrowRight}{ArrowRight}");
    // The parent caps the value at 11.
    expect(dial).toHaveAttribute("aria-valuenow", "11");
  });

  it("ignores input and leaves the tab order when disabled", async () => {
    const user = userEvent.setup();
    const onValueChange = vi.fn();
    render(
      <CircularSlider
        aria-label="Disabled"
        disabled
        defaultValue={40}
        onValueChange={onValueChange}
      />,
    );
    const dial = screen.getByRole("slider");
    layOut(dial);
    expect(dial).toHaveAttribute("aria-disabled", "true");
    expect(dial).toHaveAttribute("data-disabled");

    await user.tab();
    expect(dial).not.toHaveFocus();
    fireEvent.pointerDown(dial, { button: 0, clientX: 24, clientY: 12, pointerId: 1 });
    fireEvent.keyDown(dial, { key: "ArrowRight" });
    expect(dial).toHaveAttribute("aria-valuenow", "40");
    expect(onValueChange).not.toHaveBeenCalled();
  });

  it("submits its value under its name", async () => {
    const user = userEvent.setup();
    render(
      <form aria-label="Transform">
        <CircularSlider aria-label="Rotation" name="rotation" defaultValue={30} />
      </form>,
    );
    const form = screen.getByRole("form") as HTMLFormElement;
    expect(new FormData(form).get("rotation")).toBe("30");
    await user.tab();
    await user.keyboard("{ArrowRight}");
    expect(new FormData(form).get("rotation")).toBe("31");
  });

  it("lets a handler of its own cancel a key", async () => {
    const user = userEvent.setup();
    const onKeyDown = vi.fn((event: React.KeyboardEvent) => event.preventDefault());
    render(<CircularSlider aria-label="Rotation" defaultValue={5} onKeyDown={onKeyDown} />);
    await user.tab();
    await user.keyboard("{ArrowRight}");
    expect(onKeyDown).toHaveBeenCalledTimes(1);
    expect(screen.getByRole("slider")).toHaveAttribute("aria-valuenow", "5");
  });

  it("forwards ref, className, style and native attributes", () => {
    const ref = createRef<HTMLDivElement>();
    render(
      <CircularSlider
        ref={ref}
        aria-label="Forwarded"
        aria-valuetext="north"
        className="extra"
        id="rotation"
        data-kind="setting"
        style={{ margin: 4 }}
      />,
    );
    const dial = screen.getByRole("slider");
    expect(ref.current).toBe(dial);
    expect(dial).toHaveClass("mac-circular-slider", "extra");
    expect(dial).toHaveAttribute("id", "rotation");
    expect(dial).toHaveAttribute("aria-valuetext", "north");
    expect(dial).toHaveAttribute("data-kind", "setting");
    expect(dial).toHaveStyle({ margin: "4px" });
  });

  it("wraps a step longer than the whole range to where it lands on the dial", async () => {
    const user = userEvent.setup();
    render(<CircularSlider aria-label="Quarter" min={0} max={4} defaultValue={1} />);
    await user.tab();
    await user.keyboard("{PageUp}");
    expect(screen.getByRole("slider")).toHaveAttribute("aria-valuenow", "3");
    await user.keyboard("{PageDown}");
    expect(screen.getByRole("slider")).toHaveAttribute("aria-valuenow", "1");
  });

  it("steps by a unit smaller than ten decimal places", async () => {
    const user = userEvent.setup();
    render(<CircularSlider aria-label="Fine" min={0} max={1} step={1e-11} />);
    await user.tab();
    await user.keyboard("{ArrowUp}");
    expect(screen.getByRole("slider")).toHaveAttribute("aria-valuenow", "1e-11");
  });

  it("has the one value of a range without length", async () => {
    const user = userEvent.setup();
    const onValueChange = vi.fn();
    render(<CircularSlider aria-label="Fixed" min={5} max={5} onValueChange={onValueChange} />);
    await user.tab();
    await user.keyboard("{ArrowRight}{PageUp}");
    expect(screen.getByRole("slider")).toHaveAttribute("aria-valuenow", "5");
    expect(onValueChange).not.toHaveBeenCalled();
  });

  it("stops following a drag when it is disabled during it", () => {
    const onValueChange = vi.fn();
    const { rerender } = render(
      <CircularSlider aria-label="Angle" onValueChange={onValueChange} />,
    );
    const dial = screen.getByRole("slider");
    dial.getBoundingClientRect = () => ({ left: 0, top: 0, width: 24, height: 24 }) as DOMRect;
    fireEvent.pointerDown(dial, { button: 0, pointerId: 1, clientX: 24, clientY: 12 });
    expect(onValueChange).toHaveBeenLastCalledWith(25);

    rerender(<CircularSlider aria-label="Angle" onValueChange={onValueChange} disabled />);
    fireEvent.pointerMove(dial, { pointerId: 1, clientX: 12, clientY: 24 });
    expect(onValueChange).toHaveBeenCalledTimes(1);
  });
});
