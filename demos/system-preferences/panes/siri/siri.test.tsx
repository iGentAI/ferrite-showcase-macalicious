import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import { SystemPreferences } from "../../system-preferences";
import { describePaneControls } from "../contract";

const checkbox = (name: string) => screen.getByRole("checkbox", { name });
const popUp = (name: string) => screen.getByRole("combobox", { name });

describe("Siri pane", () => {
  it("opens at its frame size in the captured state", () => {
    render(<SystemPreferences defaultPane="siri" />);
    expect(screen.getByRole("region", { name: "Siri" })).toHaveStyle({ height: "332px" });
    for (const name of [
      "Enable Ask Siri",
      "Listen for “Hey Siri”",
      "Allow Siri when locked",
      "Show Siri in menu bar",
    ]) {
      expect(checkbox(name)).toBeChecked();
    }
    expect(popUp("Keyboard Shortcut:")).toHaveTextContent("Hold Command Space");
    expect(popUp("Language:")).toHaveTextContent("English (United States)");
    expect(popUp("Siri Voice:")).toHaveTextContent("American (Female)");
    const feedback = screen.getByRole("radiogroup", { name: "Voice Feedback:" });
    expect(within(feedback).getByRole("radio", { name: "On" })).toBeChecked();
  });

  it("chooses a voice from the pop-up button and turns voice feedback off", async () => {
    const user = userEvent.setup();
    render(<SystemPreferences defaultPane="siri" />);
    await user.click(popUp("Siri Voice:"));
    await user.click(await screen.findByRole("option", { name: "British (Male)" }));
    expect(popUp("Siri Voice:")).toHaveTextContent("British (Male)");

    await user.click(screen.getByRole("radio", { name: "Off" }));
    expect(screen.getByRole("radio", { name: "Off" })).toBeChecked();
    expect(screen.getByRole("radio", { name: "On" })).not.toBeChecked();
  });

  it("disables what depends on Ask Siri, and keeps that after leaving the pane", async () => {
    const user = userEvent.setup();
    render(<SystemPreferences defaultPane="siri" />);
    await user.click(checkbox("Enable Ask Siri"));
    expect(checkbox("Enable Ask Siri")).not.toBeChecked();
    expect(checkbox("Listen for “Hey Siri”")).toHaveAttribute("aria-disabled", "true");
    expect(popUp("Language:")).toBeDisabled();
    expect(checkbox("Show Siri in menu bar")).not.toHaveAttribute("aria-disabled", "true");

    await user.click(screen.getByRole("button", { name: "Show All" }));
    const grid = screen.getByRole("group", { name: "All preferences" });
    await user.click(within(grid).getByRole("button", { name: "Siri" }));
    expect(checkbox("Enable Ask Siri")).not.toBeChecked();
    expect(popUp("Language:")).toBeDisabled();
  });
});

describePaneControls("siri");
