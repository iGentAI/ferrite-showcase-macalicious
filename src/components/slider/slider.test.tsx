import { fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { createRef, useState } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { Slider } from "./index";

/*
 * jsdom has neither layout nor pointer capture, and Base UI's slider uses both. For the
 * pointer tests the control gets the box a 100 px long slider would have, and the
 * pointer-capture methods get stand-ins that do nothing: Base UI follows a drag with
 * listeners on the document, which jsdom does deliver.
 */
const prototype = Element.prototype as unknown as Record<string, unknown>;
const CAPTURE = ["setPointerCapture", "releasePointerCapture", "hasPointerCapture"];
// What the prototype had before, put back after each test (absent if it was absent).
const original = CAPTURE.map((name) => Object.getOwnPropertyDescriptor(prototype, name));

beforeEach(() => {
  prototype.setPointerCapture = () => {};
  prototype.releasePointerCapture = () => {};
  prototype.hasPointerCapture = () => false;
});

afterEach(() => {
  CAPTURE.forEach((name, index) => {
    const descriptor = original[index];
    if (descriptor) Object.defineProperty(prototype, name, descriptor);
    else delete prototype[name];
  });
});

function layOut(control: Element, vertical = false) {
  const box = vertical
    ? { left: 0, top: 0, right: 15, bottom: 100, width: 15, height: 100, x: 0, y: 0 }
    : { left: 0, top: 0, right: 100, bottom: 15, width: 100, height: 15, x: 0, y: 0 };
  vi.spyOn(control, "getBoundingClientRect").mockReturnValue({ ...box, toJSON: () => box });
}

describe("Slider", () => {
  it("renders a slider named by aria-label, with its class and defaults", () => {
    const { container } = render(<Slider aria-label="Volume" defaultValue={40} />);
    const input = screen.getByRole("slider", { name: "Volume" });
    expect(input).toHaveValue("40");
    expect(input).toHaveAttribute("min", "0");
    expect(input).toHaveAttribute("max", "100");
    expect(input).toHaveAttribute("aria-orientation", "horizontal");

    const root = container.firstElementChild as HTMLElement;
    expect(root).toHaveClass("mac-slider");
    expect(root).toHaveAttribute("data-size", "regular");
    expect(root).toHaveAttribute("data-orientation", "horizontal");
    expect(root).not.toHaveAttribute("data-tick-marks");
  });

  it("reflects size and orientation", () => {
    const { container } = render(<Slider aria-label="Level" size="small" orientation="vertical" />);
    const root = container.firstElementChild as HTMLElement;
    expect(root).toHaveAttribute("data-size", "small");
    expect(root).toHaveAttribute("data-orientation", "vertical");
    expect(screen.getByRole("slider")).toHaveAttribute("aria-orientation", "vertical");
  });

  it("draws the tick marks it is given and reflects their position", () => {
    const { container, rerender } = render(<Slider aria-label="Balance" tickMarks={5} />);
    const root = container.firstElementChild as HTMLElement;
    expect(root).toHaveAttribute("data-tick-marks", "below");
    expect(container.querySelectorAll(".mac-slider-tick")).toHaveLength(5);

    rerender(<Slider aria-label="Balance" tickMarks={3} tickMarkPosition="above" />);
    expect(root).toHaveAttribute("data-tick-marks", "above");
    expect(container.querySelectorAll(".mac-slider-tick")).toHaveLength(3);
  });

  it("steps with the arrow keys and jumps with Page Up, Page Down, Home and End", async () => {
    const user = userEvent.setup();
    const onValueChange = vi.fn();
    const onValueCommitted = vi.fn();
    render(
      <Slider
        aria-label="Volume"
        defaultValue={40}
        onValueChange={onValueChange}
        onValueCommitted={onValueCommitted}
      />,
    );
    const input = screen.getByRole("slider");

    await user.tab();
    expect(input).toHaveFocus();
    await user.keyboard("{ArrowRight}");
    expect(input).toHaveValue("41");
    expect(onValueChange).toHaveBeenLastCalledWith(41, expect.anything());
    expect(onValueCommitted).toHaveBeenLastCalledWith(41, expect.anything());
    await user.keyboard("{ArrowLeft}{ArrowLeft}");
    expect(input).toHaveValue("39");
    await user.keyboard("{PageUp}");
    expect(input).toHaveValue("49");
    await user.keyboard("{PageDown}");
    expect(input).toHaveValue("39");
    await user.keyboard("{End}");
    expect(input).toHaveValue("100");
    await user.keyboard("{Home}");
    expect(input).toHaveValue("0");
  });

  it("honours min, max, step and largeStep", async () => {
    const user = userEvent.setup();
    render(
      <Slider aria-label="Speed" min={10} max={20} step={2} largeStep={4} defaultValue={12} />,
    );
    const input = screen.getByRole("slider");
    await user.tab();
    await user.keyboard("{ArrowRight}");
    expect(input).toHaveValue("14");
    await user.keyboard("{PageUp}");
    expect(input).toHaveValue("18");
    await user.keyboard("{PageUp}");
    expect(input).toHaveValue("20");
    await user.keyboard("{Home}");
    expect(input).toHaveValue("10");
  });

  it("moves from mark to mark with tickMarkValuesOnly", async () => {
    const user = userEvent.setup();
    render(<Slider aria-label="Click" tickMarks={5} tickMarkValuesOnly defaultValue={50} />);
    const input = screen.getByRole("slider");
    await user.tab();
    await user.keyboard("{ArrowRight}");
    expect(input).toHaveValue("75");
    await user.keyboard("{ArrowLeft}{ArrowLeft}");
    expect(input).toHaveValue("25");
  });

  it("moves the thumb to where the track is pressed and follows a drag", () => {
    const onValueChange = vi.fn();
    const onValueCommitted = vi.fn();
    const { container } = render(
      <Slider
        aria-label="Volume"
        onValueChange={onValueChange}
        onValueCommitted={onValueCommitted}
      />,
    );
    const control = container.querySelector(".mac-slider-control") as HTMLElement;
    layOut(control);
    const input = screen.getByRole("slider");

    fireEvent.pointerDown(control, {
      button: 0,
      buttons: 1,
      clientX: 30,
      clientY: 7,
      pointerId: 1,
    });
    expect(input).toHaveValue("30");
    expect(onValueChange).toHaveBeenLastCalledWith(30, expect.anything());

    fireEvent.pointerMove(document, { buttons: 1, clientX: 80, clientY: 7, pointerId: 1 });
    expect(input).toHaveValue("80");
    fireEvent.pointerUp(document, { clientX: 80, clientY: 7, pointerId: 1 });
    expect(onValueCommitted).toHaveBeenLastCalledWith(80, expect.anything());
  });

  it("measures a vertical slider from the bottom", () => {
    const { container } = render(<Slider aria-label="Level" orientation="vertical" />);
    const control = container.querySelector(".mac-slider-control") as HTMLElement;
    layOut(control, true);
    fireEvent.pointerDown(control, {
      button: 0,
      buttons: 1,
      clientX: 7,
      clientY: 25,
      pointerId: 1,
    });
    expect(screen.getByRole("slider")).toHaveValue("75");
  });

  it("keeps its own value when uncontrolled and follows the value prop when controlled", async () => {
    const user = userEvent.setup();
    function Controlled() {
      const [value, setValue] = useState(10);
      return (
        <Slider
          aria-label="Capped"
          value={value}
          onValueChange={(next) => setValue(Math.min(next, 11))}
        />
      );
    }
    render(<Controlled />);
    const input = screen.getByRole("slider");
    await user.tab();
    await user.keyboard("{ArrowRight}{ArrowRight}{ArrowRight}");
    // The parent caps the value at 11.
    expect(input).toHaveValue("11");
  });

  it("ignores input when disabled", async () => {
    const user = userEvent.setup();
    const onValueChange = vi.fn();
    const { container } = render(
      <Slider aria-label="Disabled" disabled defaultValue={40} onValueChange={onValueChange} />,
    );
    const input = screen.getByRole("slider");
    expect(input).toBeDisabled();
    expect(container.firstElementChild).toHaveAttribute("data-disabled");

    const control = container.querySelector(".mac-slider-control") as HTMLElement;
    layOut(control);
    fireEvent.pointerDown(control, {
      button: 0,
      buttons: 1,
      clientX: 80,
      clientY: 7,
      pointerId: 1,
    });
    await user.tab();
    await user.keyboard("{ArrowRight}");
    expect(input).not.toHaveFocus();
    expect(input).toHaveValue("40");
    expect(onValueChange).not.toHaveBeenCalled();
  });

  it("gives the input its label, description and value text", () => {
    render(
      <>
        <span id="label">Brightness</span>
        <span id="hint">Of the built-in display</span>
        <Slider
          aria-labelledby="label"
          aria-describedby="hint"
          defaultValue={50}
          getAriaValueText={(_formatted, value) => `${value} percent`}
        />
      </>,
    );
    const input = screen.getByRole("slider", { name: "Brightness" });
    expect(input).toHaveAccessibleDescription("Of the built-in display");
    expect(input).toHaveAttribute("aria-valuetext", "50 percent");
  });

  it("submits its value under its name", () => {
    render(
      <form aria-label="Sound">
        <Slider aria-label="Volume" name="volume" defaultValue={70} />
      </form>,
    );
    expect(new FormData(screen.getByRole("form") as HTMLFormElement).get("volume")).toBe("70");
  });

  it("keeps its own class when className is a string or a state function", () => {
    const { container, rerender } = render(<Slider aria-label="A" className="extra" />);
    expect(container.firstElementChild).toHaveClass("mac-slider", "extra");

    rerender(
      <Slider aria-label="A" disabled className={(state) => (state.disabled ? "is-off" : "")} />,
    );
    expect(container.firstElementChild).toHaveClass("mac-slider", "is-off");
  });

  it("forwards ref, inputRef, style and native attributes", () => {
    const ref = createRef<HTMLDivElement>();
    const inputRef = createRef<HTMLInputElement>();
    const { container } = render(
      <Slider
        ref={ref}
        inputRef={inputRef}
        aria-label="Forwarded"
        id="volume"
        data-kind="setting"
        style={{ width: 120 }}
      />,
    );
    const root = container.firstElementChild as HTMLElement;
    expect(ref.current).toBe(root);
    expect(root).toHaveAttribute("id", "volume");
    expect(root).toHaveAttribute("data-kind", "setting");
    expect(root).toHaveStyle({ width: "120px" });
    expect(inputRef.current).toBe(screen.getByRole("slider"));
  });

  it("names the input through aria-labelledby", () => {
    render(
      <>
        <span id="volume">Output volume</span>
        <Slider aria-labelledby="volume" />
      </>,
    );
    expect(screen.getByRole("slider")).toHaveAccessibleName("Output volume");
  });
});
