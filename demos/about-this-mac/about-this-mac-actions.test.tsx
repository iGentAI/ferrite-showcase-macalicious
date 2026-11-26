import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { takeHelpRequest } from "../desktop/desktop-help";
import { takeOpenUrlRequests } from "../desktop/desktop-open-url";
import { DesktopWindowHostContext } from "../desktop/desktop-windows";
import { takePaneRequest } from "../system-preferences/pane-request";
import { AboutThisMac } from "./about-this-mac";
import { ABOUT_LINKS, DesktopAboutThisMac } from "./about-this-mac-desktop";

/** About This Mac in a window of the desktop, whose host opens applications (`launch`, recorded). */
function onDesktop() {
  const launch = vi.fn();
  const host = { app: "about-this-mac", stage: () => null, place: () => ({}), launch };
  render(
    <DesktopWindowHostContext value={host as never}>
      <DesktopAboutThisMac />
    </DesktopWindowHostContext>,
  );
  return launch;
}

describe("About This Mac's coloured storage bar", () => {
  it("draws what no category accounts for, with its swatch", async () => {
    const user = userEvent.setup();
    const { container } = render(
      <AboutThisMac
        coloredUsage
        volume={{
          name: "Disk",
          kind: "Test",
          capacity: 100,
          available: 40,
          categories: [{ id: "documents", name: "Documents", size: 40 }],
        }}
      />,
    );
    await user.click(screen.getByRole("tab", { name: "Storage" }));
    const widths = [
      ...container.querySelectorAll<HTMLElement>(
        ".mac-about-this-mac-segments .mac-about-this-mac-segment",
      ),
    ].map((segment) => segment.style.width);
    expect(widths).toEqual(["40%", "20%"]);
    expect(container.querySelectorAll("[data-swatch]")).toHaveLength(2);
    expect(screen.getByText("Uncategorized")).toBeInTheDocument();
  });
});

describe("About This Mac's buttons and links on the desktop", () => {
  it("open System Information and Storage Management", async () => {
    const user = userEvent.setup();
    const launch = onDesktop();
    await user.click(screen.getByRole("button", { name: "System Report…" }));
    expect(launch).toHaveBeenLastCalledWith("system-information");
    await user.click(screen.getByRole("tab", { name: "Storage" }));
    await user.click(screen.getByRole("button", { name: "Manage…" }));
    expect(launch).toHaveBeenLastCalledWith("storage-management");
  });

  it("open System Preferences on Software Update and on Displays", async () => {
    const user = userEvent.setup();
    const launch = onDesktop();
    await user.click(screen.getByRole("button", { name: "Software Update…" }));
    expect(takePaneRequest()).toBe("software-update");
    expect(launch).toHaveBeenLastCalledWith("system-preferences");
    await user.click(screen.getByRole("tab", { name: "Displays" }));
    await user.click(screen.getByRole("button", { name: "Displays Preferences…" }));
    expect(takePaneRequest()).toBe("displays");
    expect(launch).toHaveBeenLastCalledWith("system-preferences");
  });

  it("open Help Viewer for macOS Help, and Apple's page in Safari for the other links", async () => {
    const user = userEvent.setup();
    onDesktop();
    await user.click(screen.getByRole("tab", { name: "Support" }));
    await user.click(screen.getByRole("button", { name: "macOS Help" }));
    expect(takeHelpRequest()).toBe("macOS");
    await user.click(screen.getByRole("button", { name: "macOS Support" }));
    await user.click(screen.getByRole("tab", { name: "Overview" }));
    await user.click(screen.getByRole("link", { name: "License Agreement" }));
    expect(takeOpenUrlRequests().map((request) => request.url)).toEqual([
      ABOUT_LINKS["macos-support"],
      ABOUT_LINKS["license-agreement"],
    ]);
  });
});
