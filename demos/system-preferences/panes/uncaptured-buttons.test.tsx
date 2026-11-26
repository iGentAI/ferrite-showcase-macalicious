import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import { SystemPreferences } from "../system-preferences";

/**
 * Buttons whose sheet or dialog no reference screenshot shows. Each says so in a popover (`Uncaptured`), as every other
 * such button of the panes does, instead of taking the click and doing nothing.
 */
const UNCAPTURED_BUTTONS = [
  ["keyboard", "Customize Control Strip…"],
  ["keyboard", "Modifier Keys…"],
  ["keyboard", "Set Up Bluetooth Keyboard…"],
  ["trackpad", "Set Up Bluetooth Trackpad..."],
  ["network", "Add a service"],
  ["network", "Remove the selected service"],
  ["security-and-privacy", "Change Password…"],
  ["users-and-groups", "Change Password..."],
  ["users-and-groups", "Edit picture"],
  ["users-and-groups", "Open..."],
  ["network", "Advanced…"],
] as const;

describe("a button whose sheet no screenshot shows", () => {
  for (const [pane, name] of UNCAPTURED_BUTTONS) {
    it(`${pane}: ${name} says it is not part of this demo`, async () => {
      const user = userEvent.setup({ pointerEventsCheck: 0 });
      render(<SystemPreferences defaultPane={pane} />);
      await user.click(screen.getByRole("button", { name }));
      expect(await screen.findByText("Not part of this demo")).toBeInTheDocument();
      expect(
        screen.getByText(
          `No reference screenshot shows what “${name}” opens, so the demo stops here.`,
        ),
      ).toBeInTheDocument();
    });
  }

  it("network: Turn Wi-Fi Off says a web page cannot switch Wi-Fi", async () => {
    const user = userEvent.setup({ pointerEventsCheck: 0 });
    render(<SystemPreferences defaultPane="network" />);
    await user.click(screen.getByRole("button", { name: "Turn Wi-Fi Off" }));
    expect(await screen.findByText("Not part of this demo")).toBeInTheDocument();
    expect(screen.getByText("A web page cannot switch Wi-Fi.")).toBeInTheDocument();
  });

  it("network: the service commands are dimmed under the statement of why", async () => {
    const user = userEvent.setup({ pointerEventsCheck: 0 });
    render(<SystemPreferences defaultPane="network" />);
    await user.click(screen.getByRole("button", { name: "Service actions" }));
    const statement = await screen.findByRole("menuitem", {
      name: "A web page cannot edit network services.",
    });
    expect(statement).toHaveAttribute("aria-disabled", "true");
    for (const name of [
      "Duplicate Service…",
      "Rename Service…",
      "Make Service Inactive",
      "Set Service Order…",
      "Import Configurations…",
      "Export Configurations…",
      "Manage Virtual Interfaces…",
    ])
      expect(screen.getByRole("menuitem", { name })).toHaveAttribute("aria-disabled", "true");
  });
});
