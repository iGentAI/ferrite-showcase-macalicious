import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import { SystemPreferences } from "../../system-preferences";
import { describePaneControls } from "../contract";

const frame = (name: string) => screen.getByRole("region", { name });
const accounts = () => screen.getByRole("listbox", { name: "Accounts" });
const add = () => screen.getByRole("button", { name: "Add an account" });
const remove = () => screen.getByRole("button", { name: "Remove the selected account" });

describe("Internet Accounts pane", () => {
  it("opens at its frame size with two accounts, neither selected, and the providers", () => {
    render(<SystemPreferences defaultPane="internet-accounts" />);
    expect(frame("Internet Accounts")).toHaveStyle({ width: "668px", height: "486px" });
    const rows = within(accounts()).getAllByRole("option");
    expect(rows.map((row) => row.getAttribute("aria-label"))).toEqual([
      "iCloud, iCloud Drive and 10 more…",
      "Game Center",
    ]);
    for (const row of rows) expect(row).toHaveAttribute("aria-selected", "false");
    expect(add()).toBeDisabled();
    expect(remove()).toBeDisabled();

    const providers = within(screen.getByRole("group", { name: "Add an account" }));
    for (const name of ["iCloud", "Exchange", "Google", "Yahoo", "AOL", "Add Other Account…"]) {
      expect(providers.getByRole("button", { name })).toBeEnabled();
    }
  });

  it("shows a selected account in place of the providers and keeps it after leaving", async () => {
    const user = userEvent.setup();
    render(<SystemPreferences defaultPane="internet-accounts" />);
    await user.click(within(accounts()).getByText("iCloud"));
    expect(within(accounts()).getByRole("option", { selected: true })).toHaveAccessibleName(
      "iCloud, iCloud Drive and 10 more…",
    );
    const note = "The settings of the iCloud account are not part of this demo.";
    expect(within(screen.getByRole("group", { name: "iCloud" })).getByText(note)).toBeVisible();
    expect(screen.queryByRole("button", { name: "Exchange" })).toBeNull();
    expect(remove()).toBeEnabled();

    await user.click(screen.getByRole("button", { name: "Show All" }));
    await user.click(screen.getByRole("button", { name: "Back" }));
    expect(screen.getByText(note)).toBeVisible();

    // The add button brings the providers back.
    await user.click(add());
    expect(within(accounts()).queryByRole("option", { selected: true })).toBeNull();
    expect(screen.getByRole("button", { name: "Exchange" })).toBeEnabled();
    expect(add()).toBeDisabled();
  });

  it("removes the selected account from the list", async () => {
    const user = userEvent.setup();
    render(<SystemPreferences defaultPane="internet-accounts" />);
    await user.click(within(accounts()).getByText("Game Center"));
    await user.click(remove());
    expect(within(accounts()).getAllByRole("option")).toHaveLength(1);
    expect(within(accounts()).queryByText("Game Center")).toBeNull();
    expect(remove()).toBeDisabled();
    expect(screen.getByRole("group", { name: "Add an account" })).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Show All" }));
    await user.click(screen.getByRole("button", { name: "Back" }));
    expect(within(accounts()).getAllByRole("option")).toHaveLength(1);
  });
});

describePaneControls("internet-accounts");
