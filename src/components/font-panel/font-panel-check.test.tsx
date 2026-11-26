import { fireEvent, render, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { FONT_FAMILIES } from "../../lib/font-families";
import { FontPanel } from "./font-panel";

const option = (name: string) =>
  within(screen.getByRole("listbox", { name: "Family" })).getByRole("option", { name });
const NOT_HERE = "Dimmed families are not installed on this computer.";

describe("the Fonts panel's dimmed families", () => {
  it("cannot be chosen, and the panel says why, each reason once", () => {
    const onFontChange = vi.fn();
    render(
      <FontPanel
        families={FONT_FAMILIES}
        dimmedFamilies={[
          { name: "Georgia", reason: NOT_HERE },
          { name: "Optima", reason: NOT_HERE },
        ]}
        onFontChange={onFontChange}
      />,
    );
    expect(screen.getByRole("note").textContent).toBe(NOT_HERE);
    expect(option("Georgia")).toHaveAttribute("aria-disabled", "true");
    expect(option("Optima")).toHaveAttribute("aria-disabled", "true");
    expect(option("Helvetica")).not.toHaveAttribute("aria-disabled");

    fireEvent.mouseDown(option("Georgia"));
    fireEvent.click(option("Georgia"));
    expect(onFontChange).not.toHaveBeenCalledWith({ family: "Georgia" });
    fireEvent.mouseDown(option("Courier"));
    expect(onFontChange).toHaveBeenCalledWith({ family: "Courier" });
  });

  it("are listed as ever, with no note, when the page dims none", () => {
    render(<FontPanel families={FONT_FAMILIES} />);
    expect(option("Georgia")).not.toHaveAttribute("aria-disabled");
    expect(screen.queryByRole("note")).toBeNull();
  });
});
