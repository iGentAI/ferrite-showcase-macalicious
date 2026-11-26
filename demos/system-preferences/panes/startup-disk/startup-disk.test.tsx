import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import { SystemPreferences } from "../../system-preferences";
import { describePaneControls } from "../contract";

const frame = (name: string) => screen.getByRole("region", { name });
const TWO_VOLUMES = {
  "startup-disk.volumes": [
    { id: "macintosh-hd", name: "Macintosh HD", system: "macOS, 10.15", kind: "internal" },
    { id: "macintosh-ssd", name: "Macintosh SSD", system: "macOS, 10.15", kind: "external" },
  ],
};

describe("Startup Disk pane", () => {
  it("opens at its frame size, locked, with Macintosh SSD selected", () => {
    render(<SystemPreferences defaultPane="startup-disk" />);
    expect(frame("Startup Disk")).toHaveStyle({ width: "668px", height: "403px" });

    const chooser = screen.getByRole("group", {
      name: "Select the system you want to use to start up your computer",
    });
    const volumes = within(chooser).getAllByRole("button");
    expect(volumes).toHaveLength(1);
    expect(volumes[0]).toHaveAccessibleName("Macintosh SSD, macOS, 10.15");
    expect(volumes[0]).toHaveAttribute("aria-pressed", "true");
    expect(volumes[0]).toBeDisabled();
    expect(screen.getByText(/You have selected macOS, 10.15/)).toHaveTextContent(
      "on the disk “Macintosh SSD.”",
    );
    expect(screen.getByRole("button", { name: "Restart…" })).toBeEnabled();
    expect(screen.getByRole("button", { name: "Target Disk Mode…" })).toBeEnabled();
    expect(screen.getByRole("button", { name: "Click the lock to make changes." })).toBeVisible();
    expect(screen.queryByRole("progressbar")).toBeNull();
  });

  it("lets a volume be chosen once the lock is open", async () => {
    const user = userEvent.setup();
    render(<SystemPreferences defaultPane="startup-disk" defaultSettings={TWO_VOLUMES} />);
    const volume = (name: string) => screen.getByRole("button", { name: `${name}, macOS, 10.15` });
    expect(volume("Macintosh HD")).toBeDisabled();

    await user.click(screen.getByRole("button", { name: "Click the lock to make changes." }));
    expect(
      screen.getByRole("button", { name: "Click the lock to prevent further changes." }),
    ).toHaveAttribute("aria-pressed", "true");
    expect(volume("Macintosh HD")).toBeEnabled();

    await user.click(volume("Macintosh HD"));
    expect(volume("Macintosh HD")).toHaveAttribute("aria-pressed", "true");
    expect(volume("Macintosh SSD")).toHaveAttribute("aria-pressed", "false");
    expect(screen.getByText(/You have selected/)).toHaveTextContent("on the disk “Macintosh HD.”");

    // The choice and the open lock survive leaving the pane and coming back.
    await user.click(screen.getByRole("button", { name: "Show All" }));
    await user.click(screen.getByRole("button", { name: "Back" }));
    expect(volume("Macintosh HD")).toHaveAttribute("aria-pressed", "true");
    expect(volume("Macintosh HD")).toBeEnabled();
  });

  it("shows a spinner while it is still looking for volumes", () => {
    render(
      <SystemPreferences
        defaultPane="startup-disk"
        defaultSettings={{ ...TWO_VOLUMES, "startup-disk.scanning": true }}
      />,
    );
    expect(screen.getByRole("progressbar", { name: "Looking for startup disks" })).toBeVisible();
  });
});

describePaneControls("startup-disk");
