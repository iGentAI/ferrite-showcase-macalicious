import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { createRef, useState } from "react";
import { describe, expect, it, vi } from "vitest";
import { Switch } from "./index";

describe("Switch", () => {
  it("renders a switch that is off, with its class and the regular size", () => {
    render(<Switch aria-label="Do Not Disturb" />);
    const control = screen.getByRole("switch", { name: "Do Not Disturb" });
    expect(control).not.toBeChecked();
    expect(control).toHaveClass("mac-switch");
    expect(control).toHaveAttribute("data-size", "regular");
    expect(control).toHaveAttribute("data-unchecked");
  });

  it("reflects size as a data attribute", () => {
    render(<Switch aria-label="Small" size="small" />);
    expect(screen.getByRole("switch")).toHaveAttribute("data-size", "small");
  });

  it("toggles with the pointer and reports the change", async () => {
    const user = userEvent.setup();
    const onCheckedChange = vi.fn();
    render(<Switch aria-label="Wi-Fi" onCheckedChange={onCheckedChange} />);
    const control = screen.getByRole("switch");

    await user.click(control);
    expect(control).toBeChecked();
    expect(control).toHaveAttribute("data-checked");
    expect(onCheckedChange).toHaveBeenLastCalledWith(true, expect.anything());

    await user.click(control);
    expect(control).not.toBeChecked();
    expect(onCheckedChange).toHaveBeenLastCalledWith(false, expect.anything());
  });

  it("is reachable with Tab and toggles with Space and Enter", async () => {
    const user = userEvent.setup();
    render(<Switch aria-label="Wi-Fi" />);
    const control = screen.getByRole("switch");

    await user.tab();
    expect(control).toHaveFocus();
    await user.keyboard(" ");
    expect(control).toBeChecked();
    await user.keyboard("{Enter}");
    expect(control).not.toBeChecked();
  });

  it("toggles when its wrapping label is clicked, and takes its name from it", async () => {
    const user = userEvent.setup();
    render(
      // biome-ignore lint/a11y/noLabelWithoutControl: the switch renders the labelled input
      <label>
        Bluetooth
        <Switch />
      </label>,
    );
    await user.click(screen.getByText("Bluetooth"));
    expect(screen.getByRole("switch", { name: "Bluetooth" })).toBeChecked();
  });

  it("starts on with defaultChecked", () => {
    render(<Switch aria-label="On" defaultChecked />);
    expect(screen.getByRole("switch")).toBeChecked();
  });

  it("follows the checked prop when controlled", async () => {
    const user = userEvent.setup();
    const onCheckedChange = vi.fn();
    function Controlled() {
      const [checked, setChecked] = useState(false);
      return (
        <>
          <Switch
            aria-label="Controlled"
            checked={checked}
            onCheckedChange={(next) => {
              onCheckedChange(next);
              if (next) setChecked(true);
            }}
          />
          <span>{checked ? "on" : "off"}</span>
        </>
      );
    }
    render(<Controlled />);
    const control = screen.getByRole("switch");

    await user.click(control);
    expect(control).toBeChecked();
    expect(screen.getByText("on")).toBeInTheDocument();

    // The parent refuses to switch it off again: the switch stays on.
    await user.click(control);
    expect(onCheckedChange).toHaveBeenLastCalledWith(false);
    expect(control).toBeChecked();
  });

  it("ignores input and leaves the tab order when disabled", async () => {
    const user = userEvent.setup();
    const onCheckedChange = vi.fn();
    render(<Switch aria-label="Disabled" disabled onCheckedChange={onCheckedChange} />);
    const control = screen.getByRole("switch");
    expect(control).toHaveAttribute("aria-disabled", "true");
    expect(control).toHaveAttribute("data-disabled");

    await user.click(control);
    await user.tab();
    expect(control).not.toHaveFocus();
    expect(control).not.toBeChecked();
    expect(onCheckedChange).not.toHaveBeenCalled();
  });

  it("can be focused but not changed when read-only", async () => {
    const user = userEvent.setup();
    render(<Switch aria-label="Read-only" readOnly defaultChecked />);
    const control = screen.getByRole("switch");
    await user.tab();
    expect(control).toHaveFocus();
    await user.keyboard(" ");
    expect(control).toBeChecked();
  });

  it("submits its name and value with a form only while on", async () => {
    const user = userEvent.setup();
    render(
      <form aria-label="Settings">
        <Switch aria-label="Sharing" name="sharing" value="yes" />
      </form>,
    );
    const form = screen.getByRole("form") as HTMLFormElement;
    expect(new FormData(form).get("sharing")).toBeNull();
    await user.click(screen.getByRole("switch"));
    expect(new FormData(form).get("sharing")).toBe("yes");
  });

  it("keeps its own class when className is a string or a state function", () => {
    const { rerender } = render(<Switch aria-label="A" className="extra" />);
    expect(screen.getByRole("switch")).toHaveClass("mac-switch", "extra");

    rerender(
      <Switch
        aria-label="A"
        disabled
        className={(state) => (state.disabled ? "is-disabled" : "is-enabled")}
      />,
    );
    expect(screen.getByRole("switch")).toHaveClass("mac-switch", "is-disabled");
  });

  it("forwards ref, style and native attributes to the element", () => {
    const ref = createRef<HTMLElement>();
    render(
      <Switch
        ref={ref}
        aria-label="Forwarded"
        aria-describedby="hint"
        data-kind="setting"
        style={{ margin: 4 }}
      />,
    );
    const control = screen.getByRole("switch");
    expect(ref.current).toBe(control);
    expect(control).toHaveAttribute("aria-describedby", "hint");
    expect(control).toHaveAttribute("data-kind", "setting");
    expect(control).toHaveStyle({ margin: "4px" });
  });
});
