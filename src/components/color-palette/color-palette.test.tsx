import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { createRef } from "react";
import { describe, expect, it, vi } from "vitest";
import { APPLE_COLORS, ColorPalette, CRAYON_COLORS } from "./index";

const color = (name: string) => screen.getByRole("radio", { name });

describe("ColorPalette", () => {
  it("renders a named radio group of the Apple colours, none chosen", () => {
    render(<ColorPalette aria-label="Apple" />);
    const group = screen.getByRole("radiogroup", { name: "Apple" });
    expect(group).toHaveClass("mac-color-palette");
    expect(group).toHaveAttribute("data-variant", "list");
    expect(screen.getAllByRole("radio").map((radio) => radio.getAttribute("aria-label"))).toEqual(
      APPLE_COLORS.map(([name]) => name),
    );
    for (const radio of screen.getAllByRole("radio")) expect(radio).not.toBeChecked();
    expect(color("Orange").style.getPropertyValue("--_color")).toBe("#ff8000");
    expect(color("Orange")).toHaveTextContent("Orange");
  });

  it("ships the eleven Apple colours and the 48 crayons, each a name and a distinct hex value", () => {
    expect(APPLE_COLORS).toHaveLength(11);
    expect(CRAYON_COLORS).toHaveLength(48);
    for (const list of [APPLE_COLORS, CRAYON_COLORS]) {
      for (const [name, value] of list) {
        expect(name).toMatch(/^[A-Z][A-Za-z ]+$/);
        expect(value).toMatch(/^#[0-9a-f]{6}$/);
      }
      expect(new Set(list.map(([name]) => name)).size).toBe(list.length);
      expect(new Set(list.map(([, value]) => value)).size).toBe(list.length);
    }
    expect(CRAYON_COLORS[0]).toEqual(["Licorice", "#000000"]);
    expect(CRAYON_COLORS[29]).toEqual(["Sea Foam", "#00fa92"]);
    expect(CRAYON_COLORS[47]).toEqual(["Carnation", "#ff8ad8"]);
  });

  it("checks the colour whose value it holds, and none for a colour outside the palette", () => {
    const { rerender } = render(<ColorPalette aria-label="Apple" value="#ff8000" />);
    expect(color("Orange")).toBeChecked();
    expect(color("Orange")).toHaveAttribute("data-checked");
    rerender(<ColorPalette aria-label="Apple" value="#123456" />);
    for (const radio of screen.getAllByRole("radio")) expect(radio).not.toBeChecked();
  });

  it("chooses with the pointer and reports the colour's value", async () => {
    const user = userEvent.setup();
    const onValueChange = vi.fn();
    render(
      <ColorPalette aria-label="Apple" defaultValue="#000000" onValueChange={onValueChange} />,
    );
    await user.click(color("Purple"));
    expect(color("Purple")).toBeChecked();
    expect(color("Black")).not.toBeChecked();
    expect(onValueChange).toHaveBeenLastCalledWith("#800080", expect.anything());
  });

  it("is one tab stop, and the arrow keys move the choice", async () => {
    const user = userEvent.setup();
    const onValueChange = vi.fn();
    render(
      <ColorPalette aria-label="Apple" defaultValue="#0000ff" onValueChange={onValueChange} />,
    );
    await user.tab();
    expect(color("Blue")).toHaveFocus();
    await user.keyboard("{ArrowDown}");
    expect(color("Brown")).toHaveFocus();
    expect(onValueChange).toHaveBeenLastCalledWith("#996633", expect.anything());
    await user.keyboard("{ArrowUp}{ArrowUp}");
    expect(color("Black")).toBeChecked();
    await user.tab();
    expect(document.body).toHaveFocus();
  });

  it("draws the crayons as pencils, and any list of colours it is given", () => {
    const { rerender } = render(
      <ColorPalette aria-label="Pencils" variant="pencils" colors={CRAYON_COLORS} />,
    );
    expect(screen.getByRole("radiogroup")).toHaveAttribute("data-variant", "pencils");
    expect(screen.getAllByRole("radio")).toHaveLength(48);
    expect(color("Maraschino").style.getPropertyValue("--_color")).toBe("#ff2600");

    rerender(
      <ColorPalette
        aria-label="Brand"
        colors={[
          ["Ink", "#1d1d1f"],
          ["Paper", "#f5f5f7"],
        ]}
      />,
    );
    expect(screen.getAllByRole("radio")).toHaveLength(2);
    expect(color("Paper").style.getPropertyValue("--_color")).toBe("#f5f5f7");
  });

  it("does not change when disabled", async () => {
    const user = userEvent.setup();
    const onValueChange = vi.fn();
    render(<ColorPalette aria-label="Apple" disabled onValueChange={onValueChange} />);
    expect(screen.getByRole("radiogroup")).toHaveAttribute("data-disabled");
    await user.click(color("Red"));
    expect(color("Red")).not.toBeChecked();
    expect(onValueChange).not.toHaveBeenCalled();
  });

  it("forwards ref, className and native attributes", () => {
    const ref = createRef<HTMLDivElement>();
    render(<ColorPalette aria-label="Apple" ref={ref} className="extra" id="palette" />);
    expect(ref.current).toHaveClass("mac-color-palette", "extra");
    expect(ref.current).toHaveAttribute("id", "palette");
  });
});
