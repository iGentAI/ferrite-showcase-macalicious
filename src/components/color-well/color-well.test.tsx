import { fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { createRef, useState } from "react";
import { describe, expect, it, vi } from "vitest";
import { ColorWell } from "./index";

const well = () => screen.getByLabelText("Text colour") as HTMLInputElement;

describe("ColorWell", () => {
  it("renders a native colour input with its class and defaults", () => {
    render(<ColorWell aria-label="Text colour" />);
    expect(well().tagName).toBe("INPUT");
    expect(well()).toHaveAttribute("type", "color");
    expect(well()).toHaveClass("mac-color-well");
    expect(well()).toHaveAttribute("data-variant", "standard");
    expect(well()).toHaveAttribute("data-bordered");
    expect(well()).not.toHaveAttribute("data-active");
    expect(well()).not.toHaveAttribute("data-disabled");
  });

  it("takes its name from a label", () => {
    render(
      // biome-ignore lint/a11y/noLabelWithoutControl: the colour well renders the labelled input
      <label>
        Text colour
        <ColorWell />
      </label>,
    );
    expect(well()).toHaveAccessibleName("Text colour");
  });

  it("reflects variant, bordered and active as data attributes", () => {
    render(<ColorWell aria-label="Text colour" variant="toolbar" bordered={false} active />);
    expect(well()).toHaveAttribute("data-variant", "toolbar");
    expect(well()).not.toHaveAttribute("data-bordered");
    expect(well()).toHaveAttribute("data-active");
  });

  it("keeps the colour it starts with and reports a new one, when uncontrolled", () => {
    const onValueChange = vi.fn();
    render(
      <ColorWell aria-label="Text colour" defaultValue="#ff9500" onValueChange={onValueChange} />,
    );
    expect(well()).toHaveValue("#ff9500");

    fireEvent.change(well(), { target: { value: "#34c759" } });
    expect(onValueChange).toHaveBeenCalledTimes(1);
    expect(onValueChange.mock.calls[0]?.[0]).toBe("#34c759");
    expect(well()).toHaveValue("#34c759");
  });

  it("is controlled by value and onValueChange", () => {
    const onValueChange = vi.fn();
    const { rerender } = render(
      <ColorWell aria-label="Text colour" value="#000000" onValueChange={onValueChange} />,
    );
    fireEvent.change(well(), { target: { value: "#ff0000" } });
    expect(onValueChange.mock.calls[0]?.[0]).toBe("#ff0000");
    expect(well()).toHaveValue("#000000");

    rerender(<ColorWell aria-label="Text colour" value="#ff0000" onValueChange={onValueChange} />);
    expect(well()).toHaveValue("#ff0000");
  });

  it("follows a state setter passed as onValueChange", () => {
    function Controlled() {
      const [color, setColor] = useState("#000000");
      return <ColorWell aria-label="Text colour" value={color} onValueChange={setColor} />;
    }
    render(<Controlled />);
    fireEvent.change(well(), { target: { value: "#0a84ff" } });
    expect(well()).toHaveValue("#0a84ff");
  });

  it("is reachable with Tab and activated by click, where a handler can replace the chooser", async () => {
    const user = userEvent.setup();
    const onClick = vi.fn((event: React.MouseEvent) => event.preventDefault());
    render(<ColorWell aria-label="Text colour" onClick={onClick} />);

    await user.tab();
    expect(well()).toHaveFocus();
    await user.click(well());
    expect(onClick).toHaveBeenCalledTimes(1);
  });

  it("is disabled with the native attribute, leaves the tab order and ignores clicks", async () => {
    const user = userEvent.setup();
    const onClick = vi.fn();
    render(<ColorWell aria-label="Text colour" disabled onClick={onClick} />);
    expect(well()).toBeDisabled();
    expect(well()).toHaveAttribute("data-disabled");

    await user.tab();
    expect(well()).not.toHaveFocus();
    await user.click(well());
    expect(onClick).not.toHaveBeenCalled();
  });

  it("submits its colour with a form under its name", () => {
    const { container } = render(
      <form>
        <ColorWell aria-label="Text colour" name="text" defaultValue="#5e5ce6" />
      </form>,
    );
    const form = container.querySelector("form") as HTMLFormElement;
    expect(new FormData(form).get("text")).toBe("#5e5ce6");
  });

  it("keeps its own class when className is a string or a state function", () => {
    const { rerender } = render(<ColorWell aria-label="Text colour" className="extra" />);
    expect(well()).toHaveClass("mac-color-well", "extra");

    rerender(
      <ColorWell
        aria-label="Text colour"
        disabled
        className={(state) => (state.disabled ? "is-off" : "is-on")}
      />,
    );
    expect(well()).toHaveClass("mac-color-well", "is-off");
  });

  it("forwards ref, style and native attributes to the input", () => {
    const ref = createRef<HTMLElement>();
    render(
      <ColorWell
        ref={ref}
        id="text-colour"
        aria-label="Text colour"
        aria-describedby="hint"
        data-testid="subject"
        style={{ width: 60 }}
      />,
    );
    expect(ref.current).toBe(well());
    expect(ref.current).toHaveAttribute("id", "text-colour");
    expect(ref.current).toHaveAttribute("aria-describedby", "hint");
    expect(ref.current).toHaveAttribute("data-testid", "subject");
    expect(ref.current).toHaveStyle({ width: "60px" });
  });
});
