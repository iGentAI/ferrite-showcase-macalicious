import { act, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { FONT_FAMILIES } from "macalicious/lib/font-families";
import { describe, expect, it, vi } from "vitest";
import { DesktopFontPanel } from "./desktop-font-panel";
import { provideFontPanelFonts, setFontPanelFonts } from "./desktop-font-panel-fonts";

const list = () => screen.getByRole("listbox", { name: "Family" });
const families = () => [...list().querySelectorAll("[role=option]")].map((row) => row.textContent);
const three = FONT_FAMILIES.filter(({ name }) => ["Arial", "Georgia", "Times"].includes(name));
const added = {
  name: "Bramble",
  css: '"Bramble", sans-serif',
  typefaces: [{ name: "Regular", bold: false, italic: false }],
  collections: [],
};

describe("the fonts Font Book manages, in a desktop Fonts panel", () => {
  it("adds its families in their place, takes those turned off, and is asked as a panel opens", async () => {
    const user = userEvent.setup();
    const read = vi.fn();
    const stop = provideFontPanelFonts(read);
    const onFontChange = vi.fn();
    render(<DesktopFontPanel families={three} onFontChange={onFontChange} />);
    expect(read).toHaveBeenCalledTimes(1);
    expect(families()).toEqual(["Arial", "Georgia", "Times"]);

    act(() => setFontPanelFonts({ added: [added], hidden: ["Georgia"] }));
    expect(families()).toEqual(["Arial", "Bramble", "Times"]);
    await user.click(
      [...list().querySelectorAll<HTMLElement>("[role=option]")].find(
        (row) => row.textContent === "Bramble",
      ) as HTMLElement,
    );
    expect(onFontChange).toHaveBeenCalledWith({ family: "Bramble" });

    act(() => stop());
    expect(families()).toEqual(["Arial", "Georgia", "Times"]);
  });

  it("leaves a first family that does not sort first where it is", () => {
    const stop = provideFontPanelFonts(() => {});
    const system = { ...added, name: "System Font" };
    render(<DesktopFontPanel families={[system, ...three]} />);
    act(() => setFontPanelFonts({ added: [added], hidden: [] }));
    expect(families()).toEqual(["System Font", "Arial", "Bramble", "Georgia", "Times"]);
    act(() => stop());
  });
});
