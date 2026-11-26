import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { FONT_FAMILIES } from "../../lib/font-families";
import { FontPanel } from "./index";

const list = (name: string) => screen.getByRole("listbox", { name });
const option = (listName: string, name: string) =>
  [...list(listName).querySelectorAll<HTMLElement>("[role=option]")].find(
    (row) => row.textContent === name,
  ) as HTMLElement;
const selected = (listName: string) =>
  [...list(listName).querySelectorAll<HTMLElement>("[aria-selected=true]")].map(
    (row) => row.textContent,
  );

describe("FontPanel", () => {
  it("is a panel window titled Fonts that shows the format it is given", () => {
    render(
      <FontPanel
        families={FONT_FAMILIES}
        data-testid="panel"
        value={{ family: "Helvetica", bold: true, italic: true, size: 14, underline: true }}
      />,
    );
    const panel = screen.getByTestId("panel");
    expect(panel).toHaveClass("mac-window", "mac-font-panel");
    expect(panel).toHaveAttribute("data-variant", "panel");
    expect(panel).toHaveAccessibleName("Fonts");
    expect(selected("Collection")).toEqual(["All Fonts"]);
    expect(selected("Family")).toEqual(["Helvetica"]);
    // Helvetica's slanted faces are Oblique, as the Fonts panel names them.
    expect(selected("Typeface")).toEqual(["Bold Oblique"]);
    expect(selected("Size")).toEqual(["14"]);
    expect(screen.getByRole("textbox", { name: "Font size" })).toHaveValue("14");
    expect(screen.getByRole("combobox", { name: "Text underline" })).toHaveTextContent("Single");
    expect(screen.getByRole("combobox", { name: "Text strikethrough" })).toHaveTextContent("None");
  });

  it("closes from its close button, and dims Minimize and Enter Full Screen with the reason", async () => {
    const onClose = vi.fn();
    render(<FontPanel families={FONT_FAMILIES} onClose={onClose} />);
    const controls = screen.getByRole("group", { name: "Window controls" });
    expect(within(controls).getByRole("button", { name: "Minimize" })).toBeDisabled();
    expect(within(controls).getByRole("button", { name: /Full Screen|Zoom/ })).toBeDisabled();
    expect(controls).toHaveAttribute(
      "title",
      "A panel closes; it does not minimize or go full screen",
    );
    await userEvent.click(within(controls).getByRole("button", { name: "Close" }));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("reports a family, a typeface and a size chosen in its lists", () => {
    const onFontChange = vi.fn();
    render(
      <FontPanel
        families={FONT_FAMILIES}
        value={{ family: "Helvetica" }}
        onFontChange={onFontChange}
      />,
    );
    fireEvent.mouseDown(option("Family", "Georgia"));
    expect(onFontChange).toHaveBeenLastCalledWith({ family: "Georgia" });
    fireEvent.mouseDown(option("Typeface", "Bold"));
    expect(onFontChange).toHaveBeenLastCalledWith({ bold: true, italic: false });
    fireEvent.mouseDown(option("Size", "24"));
    expect(onFontChange).toHaveBeenLastCalledWith({ size: 24 });
  });

  it("applies a typed size on Return, and not a size that is not one", async () => {
    const user = userEvent.setup();
    const onFontChange = vi.fn();
    render(<FontPanel families={FONT_FAMILIES} value={{ size: 12 }} onFontChange={onFontChange} />);
    const field = screen.getByRole("textbox", { name: "Font size" });
    await user.clear(field);
    await user.type(field, "17{Enter}");
    expect(onFontChange).toHaveBeenLastCalledWith({ size: 17 });
    onFontChange.mockClear();
    await user.clear(field);
    await user.type(field, "big{Enter}");
    expect(onFontChange).not.toHaveBeenCalled();
    expect(field).toHaveValue("12");
  });

  it("applies a typed size once, also when applying it takes the focus away", async () => {
    const user = userEvent.setup();
    const onFontChange = vi.fn(() => {
      // As an editor does: it takes the keyboard back to apply the size.
      (document.activeElement as HTMLElement | null)?.blur();
    });
    render(<FontPanel families={FONT_FAMILIES} value={{ size: 12 }} onFontChange={onFontChange} />);
    const field = screen.getByRole("textbox", { name: "Font size" });
    await user.clear(field);
    await user.type(field, "20{Enter}");
    expect(onFontChange).toHaveBeenCalledTimes(1);
    expect(onFontChange).toHaveBeenLastCalledWith({ size: 20 });
  });

  it("reports the underline, the strikethrough and the colour", async () => {
    const user = userEvent.setup();
    const onFontChange = vi.fn();
    render(<FontPanel families={FONT_FAMILIES} onFontChange={onFontChange} />);
    await user.click(screen.getByRole("combobox", { name: "Text underline" }));
    await user.click(await screen.findByRole("option", { name: "Single" }));
    expect(onFontChange).toHaveBeenLastCalledWith({ underline: true });
    await waitFor(() =>
      expect(screen.queryAllByRole("option", { name: "Single" })).toHaveLength(0),
    );
    await user.click(screen.getByRole("combobox", { name: "Text strikethrough" }));
    await user.click(await screen.findByRole("option", { name: "Single" }));
    expect(onFontChange).toHaveBeenLastCalledWith({ strikethrough: true });
    fireEvent.change(screen.getByLabelText("Text color"), { target: { value: "#00ff00" } });
    expect(onFontChange).toHaveBeenLastCalledWith({ color: "#00ff00" });
  });

  it("filters the families by collection and by search, keeping the font as it is", async () => {
    const user = userEvent.setup();
    const onFontChange = vi.fn();
    render(
      <FontPanel
        families={FONT_FAMILIES}
        value={{ family: "Helvetica" }}
        onFontChange={onFontChange}
      />,
    );
    fireEvent.mouseDown(option("Collection", "Fixed Width"));
    const names = () =>
      [...list("Family").querySelectorAll("[role=option]")].map((row) => row.textContent);
    expect(names()).toEqual(["Courier", "Menlo", "Monaco"]);
    fireEvent.mouseDown(option("Collection", "All Fonts"));
    await user.type(screen.getByRole("searchbox", { name: "Search fonts" }), "times");
    expect(names()).toEqual(["Times", "Times New Roman"]);
    expect(onFontChange).not.toHaveBeenCalled();
  });

  it("has a close button that calls onClose, or the controls it is given", async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    const { rerender } = render(<FontPanel families={FONT_FAMILIES} onClose={onClose} />);
    await user.click(screen.getByRole("button", { name: "Close" }));
    expect(onClose).toHaveBeenCalledTimes(1);
    rerender(<FontPanel families={FONT_FAMILIES} controls={null} />);
    expect(screen.queryByRole("button", { name: "Close" })).toBeNull();
  });
});
