import { act, fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { createRef, useState } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import Basic from "./examples/basic";
import { Stepper } from "./index";

const stepper = () => screen.getByRole("spinbutton");
const up = () => screen.getByRole("button", { name: "Increment" });
const down = () => screen.getByRole("button", { name: "Decrement" });

afterEach(() => {
  vi.useRealTimers();
});

describe("Stepper", () => {
  it("renders a spin button with its value, class and default size", () => {
    render(<Stepper aria-label="Copies" defaultValue={3} min={1} max={9} />);
    expect(stepper()).toHaveAccessibleName("Copies");
    expect(stepper()).toHaveClass("mac-stepper");
    expect(stepper()).toHaveAttribute("data-size", "regular");
    expect(stepper()).toHaveAttribute("aria-valuenow", "3");
    expect(stepper()).toHaveAttribute("aria-valuemin", "1");
    expect(stepper()).toHaveAttribute("aria-valuemax", "9");
    expect(stepper()).not.toHaveAttribute("data-disabled");
  });

  it("starts at the minimum, or at 0, without a default value, and leaves bounds unset", () => {
    const { unmount } = render(<Stepper aria-label="Value" min={4} />);
    expect(stepper()).toHaveAttribute("aria-valuenow", "4");
    expect(stepper()).not.toHaveAttribute("aria-valuemax");
    unmount();
    render(<Stepper aria-label="Value" />);
    expect(stepper()).toHaveAttribute("aria-valuenow", "0");
    expect(stepper()).not.toHaveAttribute("aria-valuemin");
  });

  it("reflects size as a data attribute", () => {
    render(<Stepper aria-label="Value" size="mini" />);
    expect(stepper()).toHaveAttribute("data-size", "mini");
  });

  it("steps up and down when a half is clicked", async () => {
    const user = userEvent.setup();
    const onValueChange = vi.fn();
    render(<Stepper aria-label="Value" defaultValue={5} onValueChange={onValueChange} />);

    await user.click(up());
    expect(stepper()).toHaveAttribute("aria-valuenow", "6");
    expect(onValueChange).toHaveBeenLastCalledWith(6);

    await user.click(down());
    await user.click(down());
    expect(stepper()).toHaveAttribute("aria-valuenow", "4");
    expect(onValueChange).toHaveBeenCalledTimes(3);
  });

  it("steps once for a click that no pointer press came before", () => {
    render(<Stepper aria-label="Value" defaultValue={5} />);
    fireEvent.click(up());
    expect(stepper()).toHaveAttribute("aria-valuenow", "6");
    fireEvent.click(down());
    expect(stepper()).toHaveAttribute("aria-valuenow", "5");
  });

  it("does not take keyboard focus when a half is clicked", async () => {
    const user = userEvent.setup();
    render(<Stepper aria-label="Value" />);
    await user.click(up());
    expect(document.body).toHaveFocus();
    expect(up()).toHaveAttribute("tabindex", "-1");
  });

  it("steps with the arrow keys, Page Up and Page Down, Home and End", async () => {
    const user = userEvent.setup();
    render(
      <Stepper aria-label="Value" defaultValue={50} min={0} max={100} step={5} largeStep={20} />,
    );
    await user.tab();
    expect(stepper()).toHaveFocus();

    await user.keyboard("{ArrowUp}");
    expect(stepper()).toHaveAttribute("aria-valuenow", "55");
    await user.keyboard("{ArrowDown}{ArrowDown}");
    expect(stepper()).toHaveAttribute("aria-valuenow", "45");
    await user.keyboard("{PageUp}");
    expect(stepper()).toHaveAttribute("aria-valuenow", "65");
    await user.keyboard("{PageDown}{PageDown}");
    expect(stepper()).toHaveAttribute("aria-valuenow", "25");
    await user.keyboard("{End}");
    expect(stepper()).toHaveAttribute("aria-valuenow", "100");
    await user.keyboard("{Home}");
    expect(stepper()).toHaveAttribute("aria-valuenow", "0");
  });

  it("leaves Home, End and keys with a modifier to the page when it has no use for them", async () => {
    const user = userEvent.setup();
    const onValueChange = vi.fn();
    render(<Stepper aria-label="Value" onValueChange={onValueChange} />);
    await user.tab();
    await user.keyboard("{Home}{End}{Meta>}{ArrowUp}{/Meta}a");
    expect(onValueChange).not.toHaveBeenCalled();
  });

  it("calls the consumer's onKeyDown first and respects preventDefault", async () => {
    const user = userEvent.setup();
    const onValueChange = vi.fn();
    render(
      <Stepper
        aria-label="Value"
        onValueChange={onValueChange}
        onKeyDown={(event) => event.preventDefault()}
      />,
    );
    await user.tab();
    await user.keyboard("{ArrowUp}");
    expect(onValueChange).not.toHaveBeenCalled();
  });

  it("stops at its bounds without wrapping", async () => {
    const user = userEvent.setup();
    const onValueChange = vi.fn();
    render(
      <Stepper
        aria-label="Value"
        defaultValue={9}
        min={0}
        max={10}
        onValueChange={onValueChange}
      />,
    );
    await user.click(up());
    await user.click(up());
    expect(stepper()).toHaveAttribute("aria-valuenow", "10");
    expect(onValueChange).toHaveBeenCalledTimes(1);

    await user.tab();
    await user.keyboard("{PageDown}{PageDown}");
    expect(stepper()).toHaveAttribute("aria-valuenow", "0");
  });

  it("wraps past its bounds with valueWraps", async () => {
    const user = userEvent.setup();
    render(<Stepper aria-label="Minutes" defaultValue={59} min={0} max={59} valueWraps />);
    await user.click(up());
    expect(stepper()).toHaveAttribute("aria-valuenow", "0");
    await user.click(down());
    expect(stepper()).toHaveAttribute("aria-valuenow", "59");
  });

  it("keeps decimal steps exact", async () => {
    const user = userEvent.setup();
    render(<Stepper aria-label="Value" defaultValue={0.1} step={0.1} />);
    await user.click(up());
    await user.click(up());
    expect(stepper()).toHaveAttribute("aria-valuenow", "0.3");
  });

  it("repeats while a half is held and stops on release", () => {
    vi.useFakeTimers();
    const onValueChange = vi.fn();
    render(<Stepper aria-label="Value" defaultValue={0} onValueChange={onValueChange} />);

    fireEvent.pointerDown(up(), { button: 0 });
    expect(stepper()).toHaveAttribute("aria-valuenow", "1");

    act(() => vi.advanceTimersByTime(399));
    expect(stepper()).toHaveAttribute("aria-valuenow", "1");
    act(() => vi.advanceTimersByTime(1));
    expect(stepper()).toHaveAttribute("aria-valuenow", "2");
    for (let tick = 0; tick < 3; tick++) act(() => vi.advanceTimersByTime(60));
    expect(stepper()).toHaveAttribute("aria-valuenow", "5");

    fireEvent.pointerUp(up());
    fireEvent.click(up(), { detail: 1 });
    act(() => vi.advanceTimersByTime(1000));
    expect(stepper()).toHaveAttribute("aria-valuenow", "5");
    expect(onValueChange).toHaveBeenCalledTimes(5);
  });

  it("follows a step that changes, and stops when autorepeat is turned off, during a hold", () => {
    vi.useFakeTimers();
    const { rerender } = render(<Stepper aria-label="Value" />);
    fireEvent.pointerDown(up(), { button: 0 });
    expect(stepper()).toHaveAttribute("aria-valuenow", "1");

    rerender(<Stepper aria-label="Value" step={5} />);
    act(() => vi.advanceTimersByTime(400));
    expect(stepper()).toHaveAttribute("aria-valuenow", "6");

    rerender(<Stepper aria-label="Value" step={5} autorepeat={false} />);
    act(() => vi.advanceTimersByTime(1000));
    expect(stepper()).toHaveAttribute("aria-valuenow", "6");
  });

  it("stops repeating when the pointer leaves the half, at a bound, and on unmount", () => {
    vi.useFakeTimers();
    const onValueChange = vi.fn();
    const { unmount } = render(
      <Stepper aria-label="Value" defaultValue={0} max={3} onValueChange={onValueChange} />,
    );

    fireEvent.pointerDown(down(), { button: 0 });
    fireEvent.pointerLeave(down());
    act(() => vi.advanceTimersByTime(1000));
    expect(stepper()).toHaveAttribute("aria-valuenow", "-1");

    fireEvent.pointerDown(up(), { button: 0 });
    for (let tick = 0; tick < 40; tick++) act(() => vi.advanceTimersByTime(60));
    expect(stepper()).toHaveAttribute("aria-valuenow", "3");
    expect(vi.getTimerCount()).toBe(0);

    fireEvent.pointerDown(down(), { button: 0 });
    expect(vi.getTimerCount()).toBe(1);
    unmount();
    expect(vi.getTimerCount()).toBe(0);
  });

  it("steps once per press when autorepeat is off, and ignores other mouse buttons", () => {
    vi.useFakeTimers();
    render(<Stepper aria-label="Value" defaultValue={0} autorepeat={false} />);
    fireEvent.pointerDown(up(), { button: 2 });
    expect(stepper()).toHaveAttribute("aria-valuenow", "0");
    fireEvent.pointerDown(up(), { button: 0 });
    act(() => vi.advanceTimersByTime(2000));
    expect(stepper()).toHaveAttribute("aria-valuenow", "1");
  });

  it("is controlled by value and onValueChange", async () => {
    const user = userEvent.setup();
    const onValueChange = vi.fn();
    const { rerender } = render(
      <Stepper aria-label="Value" value={2} onValueChange={onValueChange} />,
    );
    await user.click(up());
    expect(onValueChange).toHaveBeenLastCalledWith(3);
    expect(stepper()).toHaveAttribute("aria-valuenow", "2");

    rerender(<Stepper aria-label="Value" value={7} onValueChange={onValueChange} />);
    expect(stepper()).toHaveAttribute("aria-valuenow", "7");
    await user.click(down());
    expect(onValueChange).toHaveBeenLastCalledWith(6);
  });

  it("repeats from the controlled value while held", () => {
    vi.useFakeTimers();
    function Controlled() {
      const [value, setValue] = useState(10);
      return <Stepper aria-label="Value" value={value} onValueChange={setValue} />;
    }
    render(<Controlled />);
    fireEvent.pointerDown(down(), { button: 0 });
    act(() => vi.advanceTimersByTime(400));
    act(() => vi.advanceTimersByTime(60));
    expect(stepper()).toHaveAttribute("aria-valuenow", "7");
  });

  it("ignores the pointer and the keyboard and leaves the tab order when disabled", async () => {
    const user = userEvent.setup();
    const onValueChange = vi.fn();
    render(<Stepper aria-label="Value" disabled onValueChange={onValueChange} />);
    expect(stepper()).toHaveAttribute("aria-disabled", "true");
    expect(stepper()).toHaveAttribute("data-disabled");
    expect(up()).toBeDisabled();
    expect(down()).toBeDisabled();

    await user.click(up());
    await user.tab();
    expect(stepper()).not.toHaveFocus();
    stepper().focus();
    await user.keyboard("{ArrowUp}");
    expect(onValueChange).not.toHaveBeenCalled();
  });

  it("submits its value through a hidden input when it has a name", async () => {
    const user = userEvent.setup();
    const { container } = render(
      <form>
        <Stepper aria-label="Copies" name="copies" defaultValue={2} />
      </form>,
    );
    await user.click(up());
    const form = container.querySelector("form") as HTMLFormElement;
    expect(new FormData(form).get("copies")).toBe("3");
  });

  it("names its halves with incrementLabel and decrementLabel", () => {
    render(<Stepper aria-label="Value" incrementLabel="Later" decrementLabel="Earlier" />);
    expect(screen.getByRole("button", { name: "Later" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Earlier" })).toBeInTheDocument();
  });

  it("forwards ref, className and native attributes to the root", () => {
    const ref = createRef<HTMLDivElement>();
    render(
      <Stepper
        ref={ref}
        className="extra"
        id="copies"
        aria-label="Copies"
        aria-valuetext="three copies"
        data-testid="subject"
        style={{ marginLeft: 4 }}
      />,
    );
    expect(ref.current).toBe(stepper());
    expect(ref.current).toHaveClass("mac-stepper", "extra");
    expect(ref.current).toHaveAttribute("id", "copies");
    expect(ref.current).toHaveAttribute("aria-valuetext", "three copies");
    expect(ref.current).toHaveAttribute("data-testid", "subject");
    expect(ref.current).toHaveStyle({ marginLeft: "4px" });
  });

  it("labels each copy of the basic example with its own label", () => {
    // The docs page shows the example in both appearances in one document.
    render(
      <>
        <Basic />
        <Basic />
      </>,
    );
    const [first, second] = screen.getAllByRole("spinbutton");
    const labels = screen.getAllByText("Copies:");
    expect(labels[0]?.id).not.toBe(labels[1]?.id);
    expect(first).toHaveAttribute("aria-labelledby", labels[0]?.id);
    expect(second).toHaveAttribute("aria-labelledby", labels[1]?.id);
  });

  it("steps by an increment written in exponent notation", () => {
    render(<Stepper aria-label="Tolerance" step={1e-7} />);
    fireEvent.click(up());
    expect(stepper()).toHaveAttribute("aria-valuenow", "1e-7");
    fireEvent.click(up());
    expect(stepper()).toHaveAttribute("aria-valuenow", "2e-7");
  });

  it("does not step again when a press leaves the half, comes back and is released", () => {
    render(<Stepper aria-label="Copies" />);
    fireEvent.pointerDown(up(), { button: 0 });
    fireEvent.pointerLeave(up());
    fireEvent.pointerUp(up());
    fireEvent.click(up(), { detail: 1 });
    expect(stepper()).toHaveAttribute("aria-valuenow", "1");
  });
});
