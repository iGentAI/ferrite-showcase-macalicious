import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { createRef, useState } from "react";
import { describe, expect, it, vi } from "vitest";
import { GestureOptionRow } from "./index";

describe("GestureOptionRow", () => {
  it("is a checkbox named by the title and described by the detail", () => {
    render(<GestureOptionRow title="Smart zoom" detail="Double-tap with one finger" />);
    const checkbox = screen.getByRole("checkbox", { name: "Smart zoom" });
    expect(checkbox).toHaveAccessibleDescription("Double-tap with one finger");
    expect(checkbox).not.toBeChecked();
  });

  it("has no description without a detail, and renders no second line", () => {
    render(<GestureOptionRow title="Tap to click" data-testid="row" />);
    expect(screen.getByRole("checkbox", { name: "Tap to click" })).not.toHaveAttribute(
      "aria-describedby",
    );
    expect(screen.getByTestId("row").querySelector(".mac-gesture-option-row-detail")).toBeNull();
  });

  it("toggles from the checkbox, from the title and with Space", async () => {
    const user = userEvent.setup();
    const onCheckedChange = vi.fn();
    render(<GestureOptionRow title="Smart zoom" onCheckedChange={onCheckedChange} />);
    const checkbox = screen.getByRole("checkbox", { name: "Smart zoom" });
    await user.click(checkbox);
    expect(checkbox).toBeChecked();
    await user.click(screen.getByText("Smart zoom"));
    expect(checkbox).not.toBeChecked();
    await user.tab();
    await user.tab({ shift: true });
    expect(checkbox).toHaveFocus();
    await user.keyboard(" ");
    expect(checkbox).toBeChecked();
    expect(onCheckedChange.mock.calls.map((call) => call[0])).toEqual([true, false, true]);
  });

  it("moves focus to the checkbox on a click on the title, so Space toggles it next", async () => {
    const user = userEvent.setup();
    const onFocus = vi.fn();
    render(
      <>
        <GestureOptionRow title="Other" />
        <GestureOptionRow title="Smart zoom" onFocus={onFocus} />
      </>,
    );
    const checkbox = screen.getByRole("checkbox", { name: "Smart zoom" });
    await user.click(screen.getByText("Smart zoom"));
    expect(checkbox).toHaveFocus();
    expect(checkbox).toBeChecked();
    expect(onFocus).toHaveBeenCalledTimes(1);
    await user.keyboard(" ");
    expect(checkbox).not.toBeChecked();
  });

  it("tells the row's onClick of a click on the title once, as of one on the checkbox", async () => {
    const user = userEvent.setup();
    const onClick = vi.fn();
    const onCheckedChange = vi.fn();
    render(
      <>
        <GestureOptionRow title="Smart zoom" onClick={onClick} onCheckedChange={onCheckedChange} />
        <GestureOptionRow title="Force Click" disabled onClick={onClick} />
      </>,
    );
    await user.click(screen.getByText("Smart zoom"));
    expect(onClick).toHaveBeenCalledTimes(1);
    expect(onCheckedChange).toHaveBeenCalledTimes(1);
    await user.click(screen.getByRole("checkbox", { name: "Smart zoom" }));
    expect(onClick).toHaveBeenCalledTimes(2);
    await user.click(screen.getByText("Force Click"));
    expect(onClick).toHaveBeenCalledTimes(3);
  });

  it("starts on with defaultChecked", () => {
    render(<GestureOptionRow title="Natural" defaultChecked />);
    expect(screen.getByRole("checkbox", { name: "Natural" })).toBeChecked();
  });

  it("stays as given when controlled, and follows its owner", async () => {
    const user = userEvent.setup();
    function Owner() {
      const [on, setOn] = useState(false);
      return (
        <>
          <GestureOptionRow title="Held" checked={false} />
          <GestureOptionRow title="Owned" checked={on} onCheckedChange={setOn} />
        </>
      );
    }
    render(<Owner />);
    await user.click(screen.getByRole("checkbox", { name: "Held" }));
    expect(screen.getByRole("checkbox", { name: "Held" })).not.toBeChecked();
    await user.click(screen.getByRole("checkbox", { name: "Owned" }));
    expect(screen.getByRole("checkbox", { name: "Owned" })).toBeChecked();
  });

  it("keeps the highlight apart from the checkbox: neither sets the other", async () => {
    const user = userEvent.setup();
    render(
      <>
        <GestureOptionRow title="Shown" highlighted data-testid="shown" />
        <GestureOptionRow title="Enabled" defaultChecked data-testid="enabled" />
      </>,
    );
    expect(screen.getByTestId("shown")).toHaveAttribute("data-highlighted");
    expect(screen.getByRole("checkbox", { name: "Shown" })).not.toBeChecked();
    expect(screen.getByTestId("enabled")).not.toHaveAttribute("data-highlighted");
    await user.click(screen.getByRole("checkbox", { name: "Enabled" }));
    expect(screen.getByTestId("enabled")).not.toHaveAttribute("data-highlighted");
    expect(screen.getByTestId("shown")).not.toHaveAttribute("aria-checked");
  });

  it("reports the pointer and focus to its owner, which moves the highlight", async () => {
    const user = userEvent.setup();
    const onPointerEnter = vi.fn();
    const onFocus = vi.fn();
    render(<GestureOptionRow title="Zoom" onPointerEnter={onPointerEnter} onFocus={onFocus} />);
    await user.hover(screen.getByText("Zoom"));
    expect(onPointerEnter).toHaveBeenCalledTimes(1);
    await user.tab();
    expect(onFocus).toHaveBeenCalledTimes(1);
  });

  it("does not toggle while disabled, from the checkbox or the title", async () => {
    const user = userEvent.setup();
    const onCheckedChange = vi.fn();
    render(
      <GestureOptionRow
        title="Force Click"
        disabled
        onCheckedChange={onCheckedChange}
        data-testid="row"
      />,
    );
    const checkbox = screen.getByRole("checkbox", { name: "Force Click" });
    expect(checkbox).toHaveAttribute("aria-disabled", "true");
    expect(screen.getByTestId("row")).toHaveAttribute("data-disabled");
    await user.click(checkbox);
    await user.click(screen.getByText("Force Click"));
    expect(onCheckedChange).not.toHaveBeenCalled();
    expect(checkbox).not.toBeChecked();
    expect(checkbox).not.toHaveFocus();
  });

  it("holds a control in the detail as a separate stop that does not toggle the checkbox", async () => {
    const user = userEvent.setup();
    const onChoose = vi.fn();
    render(
      <GestureOptionRow
        title="Secondary click"
        detail={
          <button type="button" onClick={onChoose}>
            Click on right side
          </button>
        }
      />,
    );
    const checkbox = screen.getByRole("checkbox", { name: "Secondary click" });
    await user.tab();
    expect(checkbox).toHaveFocus();
    await user.tab();
    expect(screen.getByRole("button", { name: "Click on right side" })).toHaveFocus();
    await user.keyboard("{Enter}");
    expect(onChoose).toHaveBeenCalledTimes(1);
    expect(checkbox).not.toBeChecked();
  });

  it("submits its name and value with a form while it is on", () => {
    render(
      <form data-testid="form">
        <GestureOptionRow title="Natural" name="scroll" value="natural" defaultChecked />
        <GestureOptionRow title="Zoom" name="zoom" value="smart" />
      </form>,
    );
    const data = new FormData(screen.getByTestId("form") as HTMLFormElement);
    expect(data.get("scroll")).toBe("natural");
    expect(data.has("zoom")).toBe(false);
  });

  it("forwards ref, className, style and other attributes to the row", () => {
    const ref = createRef<HTMLDivElement>();
    render(
      <GestureOptionRow
        ref={ref}
        title="Zoom"
        className="gesture"
        style={{ width: 300 }}
        id="zoom"
        data-gesture="zoom"
      />,
    );
    expect(ref.current).toHaveClass("mac-gesture-option-row", "gesture");
    expect(ref.current).toHaveStyle({ width: "300px" });
    expect(ref.current).toHaveAttribute("id", "zoom");
    expect(ref.current).toHaveAttribute("data-gesture", "zoom");
  });
});
