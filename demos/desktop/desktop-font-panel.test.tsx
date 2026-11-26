import { fireEvent, render, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { FONT_FAMILIES } from "../../src/lib/font-families";
import { DesktopFontPanel, NOT_INSTALLED } from "./desktop-font-panel";

// jsdom measures no text: the check is stood in for, with Georgia and Optima missing.
vi.mock("./font-family-check", async (original) => ({
  ...(await original<typeof import("./font-family-check")>()),
  familyRenders: (name: string) => name !== "Georgia" && name !== "Optima",
}));

const option = (name: string) =>
  within(screen.getByRole("listbox", { name: "Family" })).getByRole("option", { name });

describe("the desktop's Fonts panel", () => {
  it("dims the families the browser has no font for, which cannot be chosen, and says why", async () => {
    const onFontChange = vi.fn();
    render(<DesktopFontPanel families={FONT_FAMILIES} onFontChange={onFontChange} />);
    expect(await screen.findByRole("note")).toHaveTextContent(NOT_INSTALLED);
    expect(option("Georgia")).toHaveAttribute("aria-disabled", "true");
    expect(option("Optima")).toHaveAttribute("aria-disabled", "true");
    expect(option("Helvetica")).not.toHaveAttribute("aria-disabled");

    fireEvent.mouseDown(option("Georgia"));
    fireEvent.click(option("Georgia"));
    expect(onFontChange).not.toHaveBeenCalledWith({ family: "Georgia" });
    fireEvent.mouseDown(option("Courier"));
    expect(onFontChange).toHaveBeenCalledWith({ family: "Courier" });
  });
});
