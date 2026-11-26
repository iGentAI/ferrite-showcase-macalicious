import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import { SystemPreferences } from "../../system-preferences";
import { describePaneControls } from "../contract";

const frame = (name: string) => screen.getByRole("region", { name });
const popUp = (name: string) => screen.getByRole("combobox", { name });

describe("Printers & Scanners pane", () => {
  it("opens at its frame size with the printer selected and idle", () => {
    render(<SystemPreferences defaultPane="printers-and-scanners" />);
    expect(frame("Printers & Scanners")).toHaveStyle({ height: "438px" });
    const list = screen.getByRole("listbox", { name: "Printers" });
    expect(within(list).getByRole("option", { selected: true })).toHaveAccessibleName(
      "Example LP-2270DW series, Idle, Last Used",
    );
    const detail = within(screen.getByRole("group", { name: "Example LP-2270DW series" }));
    expect(detail.getByText("Example LP-2270DW-AirPrint")).toBeVisible();
    expect(
      detail.getByRole("checkbox", { name: "Share this printer on the network" }),
    ).not.toBeChecked();
    expect(popUp("Default printer:")).toHaveTextContent("Last Printer Used");
    expect(popUp("Default paper size:")).toHaveTextContent("US Letter");
    const edit = within(screen.getByRole("group", { name: "Edit printers" }));
    expect(edit.getAllByRole("button")).toHaveLength(2);
  });

  it("shares the printer and chooses a paper size, and keeps the printer selected", async () => {
    const user = userEvent.setup();
    render(<SystemPreferences defaultPane="printers-and-scanners" />);
    const share = screen.getByRole("checkbox", { name: "Share this printer on the network" });
    await user.click(share);
    expect(share).toBeChecked();

    await user.click(popUp("Default paper size:"));
    await user.click(await screen.findByRole("option", { name: "A4" }));
    expect(popUp("Default paper size:")).toHaveTextContent("A4");

    const list = screen.getByRole("listbox", { name: "Printers" });
    await user.click(within(list).getByText("Example LP-2270DW series"));
    expect(within(list).getByRole("option", { selected: true })).toBeInTheDocument();
  });

  it("opens the Sharing pane from Sharing Preferences and keeps its settings", async () => {
    const user = userEvent.setup();
    render(<SystemPreferences defaultPane="printers-and-scanners" />);
    await user.click(popUp("Default printer:"));
    await user.click(await screen.findByRole("option", { name: "Example LP-2270DW series" }));

    await user.click(screen.getByRole("button", { name: "Sharing Preferences…" }));
    expect(frame("Sharing")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Back" }));
    expect(frame("Printers & Scanners")).toHaveStyle({ height: "438px" });
    expect(popUp("Default printer:")).toHaveTextContent("Example LP-2270DW series");
  });
});

describePaneControls("printers-and-scanners");
