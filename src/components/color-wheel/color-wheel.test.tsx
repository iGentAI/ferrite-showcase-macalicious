import { fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { createRef, useState } from "react";
import { describe, expect, it, vi } from "vitest";
import { ColorSpectrum, ColorWheel } from "./index";

const area = () => screen.getByRole("slider", { name: "Hue and saturation" });
const brightness = () => screen.getByRole("slider", { name: "Brightness" });

/** jsdom lays nothing out: give the area a 200 x 200 (or 200 x 100) pt box at the origin. */
function box(element: HTMLElement, height = 200) {
  element.getBoundingClientRect = () =>
    ({ left: 0, top: 0, width: 200, height, right: 200, bottom: height, x: 0, y: 0 }) as DOMRect;
  return element;
}

const press = (element: HTMLElement, clientX: number, clientY: number, button = 0) =>
  fireEvent.pointerDown(element, { clientX, clientY, button, pointerId: 1 });

describe("ColorWheel", () => {
  it("renders the area and a brightness slider, both named, with its class", () => {
    render(<ColorWheel data-testid="root" defaultValue="#ff0000" />);
    const root = screen.getByTestId("root");
    expect(root).toHaveClass("mac-color-wheel");
    expect(root).toHaveAttribute("data-shape", "wheel");
    expect(area()).toHaveClass("mac-color-wheel-area");
    expect(area()).toHaveAttribute("tabindex", "0");
    expect(area()).toHaveAttribute("aria-valuenow", "0");
    expect(area()).toHaveAttribute("aria-valuetext", "Hue 0°, saturation 100%, brightness 100%");
    expect(brightness()).toHaveValue("100");
  });

  it("places the marker by hue and saturation and passes the brightness to the stylesheet", () => {
    render(<ColorWheel defaultValue="#800000" />);
    const style = area().style;
    // Red is at three o'clock, on the rim.
    expect(Number(style.getPropertyValue("--_x"))).toBeCloseTo(1);
    expect(Number(style.getPropertyValue("--_y"))).toBeCloseTo(0.5);
    expect(Number(style.getPropertyValue("--_v"))).toBeCloseTo(128 / 255);
  });

  it("picks the colour under the pointer: hue from the angle, saturation from the radius", () => {
    const onValueChange = vi.fn();
    render(<ColorWheel onValueChange={onValueChange} />);
    box(area());
    press(area(), 100, 0); // twelve o'clock, on the rim: hue 90
    expect(onValueChange).toHaveBeenLastCalledWith("#80ff00");
    press(area(), 0, 100); // nine o'clock: cyan
    expect(onValueChange).toHaveBeenLastCalledWith("#00ffff");
    press(area(), 150, 100); // half way out towards red
    expect(onValueChange).toHaveBeenLastCalledWith("#ff8080");
    press(area(), 100, 100); // the centre
    expect(onValueChange).toHaveBeenLastCalledWith("#ffffff");
  });

  it("clamps a point outside the disc to its rim", () => {
    const onValueChange = vi.fn();
    render(<ColorWheel onValueChange={onValueChange} />);
    box(area());
    press(area(), 400, 100);
    expect(onValueChange).toHaveBeenLastCalledWith("#ff0000");
  });

  it("follows the pointer only while it holds the capture, and ignores other buttons", () => {
    const onValueChange = vi.fn();
    render(<ColorWheel onValueChange={onValueChange} />);
    const element = box(area());
    press(element, 0, 100, 2);
    fireEvent.pointerMove(element, { clientX: 0, clientY: 100, pointerId: 1 });
    expect(onValueChange).not.toHaveBeenCalled();

    element.hasPointerCapture = () => true;
    fireEvent.pointerMove(element, { clientX: 0, clientY: 100, pointerId: 1 });
    expect(onValueChange).toHaveBeenLastCalledWith("#00ffff");
  });

  it("stops following a drag once it is disabled", () => {
    const onValueChange = vi.fn();
    const { rerender } = render(<ColorWheel onValueChange={onValueChange} />);
    const element = box(area());
    element.hasPointerCapture = () => true;
    rerender(<ColorWheel disabled onValueChange={onValueChange} />);
    fireEvent.pointerMove(element, { clientX: 0, clientY: 100, pointerId: 1 });
    expect(onValueChange).not.toHaveBeenCalled();
  });

  it("moves the marker with the arrow keys, further with Shift", async () => {
    const user = userEvent.setup();
    const onValueChange = vi.fn();
    render(<ColorWheel defaultValue="#ffffff" onValueChange={onValueChange} />);
    await user.tab();
    expect(area()).toHaveFocus();
    await user.keyboard("{ArrowRight}");
    // 2% of the width from the centre towards red: saturation 4%.
    expect(onValueChange).toHaveBeenLastCalledWith("#fff5f5");
    await user.keyboard("{Shift>}{ArrowRight}{/Shift}");
    expect(onValueChange).toHaveBeenLastCalledWith("#ffc2c2");
    await user.keyboard("{ArrowLeft}{ArrowUp}{ArrowDown}");
    expect(onValueChange).toHaveBeenLastCalledWith("#ffcccc");
  });

  it("sets the brightness with the slider and keeps the hue while the colour is black", async () => {
    const user = userEvent.setup();
    const onValueChange = vi.fn();
    render(<ColorWheel defaultValue="#0000ff" onValueChange={onValueChange} />);
    await user.tab();
    await user.tab();
    expect(brightness()).toHaveFocus();
    await user.keyboard("{Home}");
    expect(onValueChange).toHaveBeenLastCalledWith("#000000");
    expect(area()).toHaveAttribute("aria-valuenow", "240");
    await user.keyboard("{End}");
    expect(onValueChange).toHaveBeenLastCalledWith("#0000ff");
  });

  it("is controlled by value and onValueChange", () => {
    const onValueChange = vi.fn();
    const { rerender } = render(<ColorWheel value="#ff0000" onValueChange={onValueChange} />);
    box(area());
    press(area(), 0, 100);
    expect(onValueChange).toHaveBeenLastCalledWith("#00ffff");
    expect(area()).toHaveAttribute("aria-valuenow", "0");
    rerender(<ColorWheel value="#00ff00" onValueChange={onValueChange} />);
    expect(area()).toHaveAttribute("aria-valuenow", "120");
  });

  it("keeps the opacity of the value it was given", () => {
    const onValueChange = vi.fn();
    render(<ColorWheel defaultValue="#ff000080" onValueChange={onValueChange} />);
    box(area());
    press(area(), 0, 100);
    expect(onValueChange).toHaveBeenLastCalledWith("#00ffff80");
  });

  it("ignores the pointer and the keyboard when disabled, and leaves the tab order", async () => {
    const user = userEvent.setup();
    const onValueChange = vi.fn();
    render(<ColorWheel data-testid="root" disabled onValueChange={onValueChange} />);
    expect(screen.getByTestId("root")).toHaveAttribute("data-disabled");
    expect(area()).toHaveAttribute("aria-disabled", "true");
    expect(area()).not.toHaveAttribute("tabindex");
    box(area());
    press(area(), 0, 100);
    fireEvent.keyDown(area(), { key: "ArrowRight" });
    await user.tab();
    expect(document.body).toHaveFocus();
    expect(onValueChange).not.toHaveBeenCalled();
  });

  it("forwards ref, className, areaLabel and native attributes", () => {
    const ref = createRef<HTMLDivElement>();
    render(<ColorWheel ref={ref} className="extra" id="wheel" areaLabel="Tint" />);
    expect(ref.current).toHaveClass("mac-color-wheel", "extra");
    expect(ref.current).toHaveAttribute("id", "wheel");
    expect(screen.getByRole("slider", { name: "Tint" })).toBeInTheDocument();
  });
});

describe("ColorSpectrum", () => {
  it("renders the area alone, as a rectangle", () => {
    render(<ColorSpectrum data-testid="root" />);
    expect(screen.getByTestId("root")).toHaveAttribute("data-shape", "spectrum");
    expect(screen.getAllByRole("slider")).toHaveLength(1);
  });

  it("picks hue across, white at the top edge and black at the bottom edge", () => {
    const onValueChange = vi.fn();
    render(<ColorSpectrum onValueChange={onValueChange} />);
    box(area(), 100);
    press(area(), 100, 50); // the middle: cyan at full strength
    expect(onValueChange).toHaveBeenLastCalledWith("#00ffff");
    press(area(), 100, 25); // half way to the top: half the saturation
    expect(onValueChange).toHaveBeenLastCalledWith("#80ffff");
    press(area(), 100, 75); // half way to the bottom: half the brightness
    expect(onValueChange).toHaveBeenLastCalledWith("#008080");
    press(area(), 100, 100);
    expect(onValueChange).toHaveBeenLastCalledWith("#000000");
    press(area(), 0, 50);
    expect(onValueChange).toHaveBeenLastCalledWith("#ff0000");
  });

  it("places the marker where its colour is, and moves it with the arrow keys", async () => {
    const user = userEvent.setup();
    function Controlled() {
      const [value, setValue] = useState("#00ffff");
      return <ColorSpectrum value={value} onValueChange={setValue} />;
    }
    render(<Controlled />);
    const style = area().style;
    expect(Number(style.getPropertyValue("--_x"))).toBeCloseTo(0.5);
    expect(Number(style.getPropertyValue("--_y"))).toBeCloseTo(0.5);
    await user.tab();
    await user.keyboard("{Shift>}{ArrowDown}{/Shift}");
    expect(Number(style.getPropertyValue("--_y"))).toBeCloseTo(0.6);
    expect(area()).toHaveAttribute("aria-valuetext", "Hue 180°, saturation 100%, brightness 80%");
  });
});
