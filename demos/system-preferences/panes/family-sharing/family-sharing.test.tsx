import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import { SystemPreferences } from "../../system-preferences";
import { describePaneControls } from "../contract";

describe("Family Sharing pane", () => {
  it("opens at its frame size on the introduction, with what a family shares as a list", () => {
    render(<SystemPreferences defaultPane="family-sharing" />);
    expect(screen.getByRole("region", { name: "Family Sharing" })).toHaveStyle({
      width: "668px",
      height: "328px",
    });
    const list = screen.getByRole("list", { name: "Set up Family Sharing" });
    const items = within(list).getAllByRole("listitem");
    expect(items).toHaveLength(6);
    expect(items[0]).toHaveTextContent("Share purchased apps, music, movies, books, and TV shows.");
    expect(items[5]).toHaveTextContent("Create accounts for children in your family.");
  });

  it("has an enabled default button and a help button", () => {
    render(<SystemPreferences defaultPane="family-sharing" />);
    const next = screen.getByRole("button", { name: "Next" });
    expect(next).toBeEnabled();
    expect(next).toHaveAttribute("data-variant", "primary");
    expect(screen.getByRole("button", { name: "Help" })).toBeEnabled();
  });

  it("says that the setup is not part of the demo when Next is clicked, and is found by what it shares", async () => {
    const user = userEvent.setup();
    render(<SystemPreferences defaultPane="family-sharing" />);
    await user.click(screen.getByRole("button", { name: "Next" }));
    expect(await screen.findByRole("dialog", { name: "Not part of this demo" })).toBeVisible();
    expect(screen.getByRole("list", { name: "Set up Family Sharing" })).toBeInTheDocument();
    await user.keyboard("{Escape}");

    await user.type(screen.getByRole("searchbox"), "apple music{Enter}");
    expect(screen.getByRole("region", { name: "Family Sharing" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Next" })).toBeInTheDocument();
  });
});

describePaneControls("family-sharing");
