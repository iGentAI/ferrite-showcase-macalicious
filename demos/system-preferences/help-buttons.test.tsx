import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import { CATALOGUE } from "./catalogue";
import { PANES } from "./panes";
import { SystemPreferences } from "./system-preferences";

const spaced = (name: string) => name.replace(/\s+/g, " ").trim();

/**
 * The panes' Help buttons (the round "?" at their foot): no reference screenshot shows the help
 * they open, so each answers as every other uncaptured control does (`panes/uncaptured.tsx`), with
 * a popover that says so, rather than doing nothing.
 */
describe("System Preferences' Help buttons", () => {
  it("answer in every pane, saying the help they open is not part of the demo", async () => {
    const user = userEvent.setup();
    const answered: string[] = [];
    for (const id of PANES.keys()) {
      const entry = CATALOGUE.get(id);
      if (!entry) continue;
      const view = render(<SystemPreferences />);
      // The pane's button in the grid, by its name or its caption read as one line.
      const open = screen
        .getAllByRole("button")
        .find((button) =>
          [entry.name, entry.caption.join(" ")].includes(
            spaced(button.getAttribute("aria-label") ?? button.textContent ?? ""),
          ),
        );
      expect(open, `no button opens ${entry.name}`).toBeDefined();
      await user.click(open as HTMLElement);
      const helps = screen.queryAllByRole("button", { name: "Help" });
      for (const help of helps) {
        expect(help, `${entry.name}'s Help button`).toBeEnabled();
        await user.click(help);
        const popover = await screen.findByRole("dialog", { name: "Not part of this demo" });
        expect(popover, entry.name).toHaveTextContent("what “Help” opens");
        await user.keyboard("{Escape}");
        answered.push(id);
      }
      view.unmount();
    }
    // The eleven panes whose Help button did nothing before, among all that have one.
    expect(answered).toEqual(
      expect.arrayContaining([
        "general",
        "dock",
        "date-and-time",
        "displays",
        "keyboard",
        "network",
        "notifications",
        "security-and-privacy",
        "sound",
        "trackpad",
        "users-and-groups",
      ]),
    );
  }, 120_000);
});
