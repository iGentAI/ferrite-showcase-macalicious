import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { createRef, useState } from "react";
import { describe, expect, it, vi } from "vitest";
import { BevelButton, BevelButtonGroup } from "./index";

describe("BevelButton", () => {
  it("renders a native toggle button that is off, with square corners", () => {
    render(<BevelButton>Grid</BevelButton>);
    const button = screen.getByRole("button", { name: "Grid", pressed: false });
    expect(button.tagName).toBe("BUTTON");
    expect(button).toHaveClass("mac-bevel-button");
    expect(button).toHaveAttribute("data-variant", "square");
    expect(button).not.toHaveAttribute("data-pressed");
  });

  it("reflects the rounded variant", () => {
    render(<BevelButton variant="rounded">Grid</BevelButton>);
    expect(screen.getByRole("button")).toHaveAttribute("data-variant", "rounded");
  });

  it("toggles when uncontrolled, with the pointer, Space and Enter", async () => {
    const user = userEvent.setup();
    const onPressedChange = vi.fn();
    render(<BevelButton onPressedChange={onPressedChange}>Grid</BevelButton>);
    const button = screen.getByRole("button");

    await user.click(button);
    expect(button).toHaveAttribute("aria-pressed", "true");
    expect(button).toHaveAttribute("data-pressed");
    expect(onPressedChange.mock.lastCall?.[0]).toBe(true);

    await user.keyboard(" ");
    expect(button).toHaveAttribute("aria-pressed", "false");

    await user.keyboard("{Enter}");
    expect(button).toHaveAttribute("aria-pressed", "true");
    expect(onPressedChange).toHaveBeenCalledTimes(3);
  });

  it("starts on with defaultPressed and shows only the given state when controlled", async () => {
    const user = userEvent.setup();
    const onPressedChange = vi.fn();
    render(
      <>
        <BevelButton defaultPressed>Snap</BevelButton>
        <BevelButton pressed={false} onPressedChange={onPressedChange}>
          Grid
        </BevelButton>
      </>,
    );
    expect(screen.getByRole("button", { name: "Snap" })).toHaveAttribute("aria-pressed", "true");
    const controlled = screen.getByRole("button", { name: "Grid" });
    await user.click(controlled);
    expect(onPressedChange.mock.lastCall?.[0]).toBe(true);
    expect(controlled).toHaveAttribute("aria-pressed", "false");
  });

  it("does not toggle and leaves the tab order when disabled", async () => {
    const user = userEvent.setup();
    const onPressedChange = vi.fn();
    render(
      <BevelButton disabled onPressedChange={onPressedChange}>
        Grid
      </BevelButton>,
    );
    const button = screen.getByRole("button");
    expect(button).toBeDisabled();
    await user.click(button);
    await user.tab();
    expect(onPressedChange).not.toHaveBeenCalled();
    expect(button).not.toHaveFocus();
  });

  it("forwards ref, className and native attributes", () => {
    const ref = createRef<HTMLButtonElement>();
    render(
      <BevelButton ref={ref} id="grid" className="extra" aria-label="Grid">
        <svg aria-hidden="true" />
      </BevelButton>,
    );
    expect(ref.current).toBe(screen.getByRole("button", { name: "Grid" }));
    expect(ref.current).toHaveClass("mac-bevel-button", "extra");
    expect(ref.current).toHaveAttribute("id", "grid");
  });
});

describe("BevelButtonGroup", () => {
  function Pair(props: { onValueChange?: (value: string[]) => void }) {
    return (
      <BevelButtonGroup
        aria-label="Orientation"
        defaultValue={["portrait"]}
        onValueChange={props.onValueChange}
      >
        <BevelButton value="portrait">Portrait</BevelButton>
        <BevelButton value="landscape">Landscape</BevelButton>
      </BevelButtonGroup>
    );
  }

  it("is a named group that keeps one button on at a time", async () => {
    const user = userEvent.setup();
    const onValueChange = vi.fn();
    render(<Pair onValueChange={onValueChange} />);
    expect(screen.getByRole("group", { name: "Orientation" })).toHaveClass(
      "mac-bevel-button-group",
    );
    const portrait = screen.getByRole("button", { name: "Portrait" });
    const landscape = screen.getByRole("button", { name: "Landscape" });
    expect(portrait).toHaveAttribute("aria-pressed", "true");

    await user.click(landscape);
    expect(landscape).toHaveAttribute("aria-pressed", "true");
    expect(portrait).toHaveAttribute("aria-pressed", "false");
    expect(onValueChange.mock.lastCall?.[0]).toEqual(["landscape"]);
  });

  it("moves between its buttons with the arrow keys and is one stop in the tab order", async () => {
    const user = userEvent.setup();
    render(
      <>
        <Pair />
        <button type="button">After</button>
      </>,
    );
    await user.tab();
    expect(screen.getByRole("button", { name: "Portrait" })).toHaveFocus();
    await user.keyboard("{ArrowRight}");
    expect(screen.getByRole("button", { name: "Landscape" })).toHaveFocus();
    await user.keyboard(" ");
    expect(screen.getByRole("button", { name: "Landscape" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    await user.tab();
    expect(screen.getByRole("button", { name: "After" })).toHaveFocus();
  });

  it("can be controlled so that one button always stays on", async () => {
    const user = userEvent.setup();
    function Controlled() {
      const [value, setValue] = useState(["portrait"]);
      return (
        <BevelButtonGroup
          aria-label="Orientation"
          value={value}
          onValueChange={(next) => {
            if (next.length > 0) setValue(next);
          }}
        >
          <BevelButton value="portrait">Portrait</BevelButton>
          <BevelButton value="landscape">Landscape</BevelButton>
        </BevelButtonGroup>
      );
    }
    render(<Controlled />);
    const portrait = screen.getByRole("button", { name: "Portrait" });
    await user.click(portrait);
    expect(portrait).toHaveAttribute("aria-pressed", "true");
  });

  it("allows several buttons on with multiple, and forwards its ref", async () => {
    const user = userEvent.setup();
    const ref = createRef<HTMLDivElement>();
    render(
      <BevelButtonGroup ref={ref} aria-label="Style" multiple className="extra">
        <BevelButton value="bold">Bold</BevelButton>
        <BevelButton value="italic">Italic</BevelButton>
      </BevelButtonGroup>,
    );
    await user.click(screen.getByRole("button", { name: "Bold" }));
    await user.click(screen.getByRole("button", { name: "Italic" }));
    expect(screen.getByRole("button", { name: "Bold" })).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByRole("button", { name: "Italic" })).toHaveAttribute("aria-pressed", "true");
    expect(ref.current).toBe(screen.getByRole("group", { name: "Style" }));
    expect(ref.current).toHaveClass("mac-bevel-button-group", "extra");
  });
});
