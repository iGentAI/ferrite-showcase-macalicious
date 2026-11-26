import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ManagedWindowRenderProps } from "macalicious/managed-window";
import { MenuItem } from "macalicious/menu-item";
import { Submenu, SubmenuPopup, SubmenuTrigger } from "macalicious/submenu";
import { TitleBar } from "macalicious/title-bar";
import { Window, WindowBody } from "macalicious/window";
import { describe, expect, it, vi } from "vitest";
import { CatalinaDesktop } from "../desktop/desktop";
import { useDesktopAppMenu } from "../desktop/desktop-app-menus";
import type { DesktopApp } from "../desktop/desktop-apps";
import { helpViewerApp } from "./app";

const sharpen = vi.fn();

/** Rows drawn by a component of the application's, as many applications' are. */
function SharpenRows() {
  return <MenuItem onClick={sharpen}>Sharpen</MenuItem>;
}

/** A submenu a shared component draws, as Speech is in most applications' Edit menus. */
function SpeechRows() {
  return (
    <Submenu>
      <SubmenuTrigger>Speech</SubmenuTrigger>
      <SubmenuPopup>
        <MenuItem>Start Speaking</MenuItem>
        <MenuItem>Stop Speaking</MenuItem>
      </SubmenuPopup>
    </Submenu>
  );
}

function Workbench({
  onClose: _onClose,
  onMinimize: _onMinimize,
  onZoom: _onZoom,
  zoomRole: _zoomRole,
  minimizeDisabled: _minimizeDisabled,
  zoomDisabled: _zoomDisabled,
  onDragRegionPointerDown: _down,
  onDragRegionDoubleClick: _double,
  ...windowProps
}: ManagedWindowRenderProps) {
  useDesktopAppMenu(
    "workbench",
    "Tools",
    <>
      <SharpenRows />
      <SpeechRows />
      <MenuItem disabled>Sharpen Harder</MenuItem>
      <Submenu>
        <SubmenuTrigger>Effects</SubmenuTrigger>
        <SubmenuPopup>
          <MenuItem>Blur</MenuItem>
        </SubmenuPopup>
      </Submenu>
    </>,
  );
  return (
    <Window {...windowProps}>
      <TitleBar title="Workbench" />
      <WindowBody />
    </Window>
  );
}

const APPS: DesktopApp[] = [
  {
    id: "workbench",
    name: "Workbench",
    component: Workbench,
    defaultSize: { width: 400, height: 300 },
    menus: ["Workbench", "Tools", "Help"],
  },
  helpViewerApp as unknown as DesktopApp,
];

const field = () => within(screen.getByRole("menu")).getByRole("searchbox", { name: "Search" });

async function openHelp(user: ReturnType<typeof userEvent.setup>) {
  await user.click(screen.getByRole("menuitem", { name: "Help" }));
  await waitFor(() => expect(field()).toHaveFocus());
}

describe("the Help menu's field", () => {
  it("finds a row a component draws and points at it with the arrow", async () => {
    const user = userEvent.setup();
    render(<CatalinaDesktop apps={APPS} defaultOpen={["workbench"]} />);
    await openHelp(user);
    await user.keyboard("sharpen");
    const result = await screen.findByRole("menuitem", { name: "Tools ▸ Sharpen" });

    await user.click(result);
    const row = await screen.findByRole("menuitem", { name: "Sharpen" });
    expect(sharpen).not.toHaveBeenCalled();
    await waitFor(() =>
      expect(document.querySelector(".mac-help-viewer-menu-arrow")).not.toBeNull(),
    );

    await user.click(row);
    expect(sharpen).toHaveBeenCalledTimes(1);
    await waitFor(() => expect(document.querySelector(".mac-help-viewer-menu-arrow")).toBeNull());
  });

  it("finds a row of a submenu a component draws, and points at it", async () => {
    const user = userEvent.setup();
    render(<CatalinaDesktop apps={APPS} defaultOpen={["workbench"]} />);
    await openHelp(user);
    await user.keyboard("speaking");
    await screen.findByRole("menuitem", { name: "Tools ▸ Speech ▸ Stop Speaking" });
    await user.click(screen.getByRole("menuitem", { name: "Tools ▸ Speech ▸ Start Speaking" }));
    await screen.findByRole("menuitem", { name: "Start Speaking" });
    await waitFor(() =>
      expect(document.querySelector(".mac-help-viewer-menu-arrow")).not.toBeNull(),
    );
    await user.keyboard("{Escape}");
  });

  it("finds a dimmed row, and points at it", async () => {
    const user = userEvent.setup();
    render(<CatalinaDesktop apps={APPS} defaultOpen={["workbench"]} />);
    await openHelp(user);
    await user.keyboard("harder");
    await user.click(await screen.findByRole("menuitem", { name: "Tools ▸ Sharpen Harder" }));
    const row = await screen.findByRole("menuitem", { name: "Sharpen Harder" });
    expect(row).toHaveAttribute("aria-disabled", "true");
    await waitFor(() =>
      expect(document.querySelector(".mac-help-viewer-menu-arrow")).not.toBeNull(),
    );
    await user.keyboard("{Escape}");
  });

  it("finds a row inside a submenu, opens the submenu and points at the row", async () => {
    const user = userEvent.setup();
    render(<CatalinaDesktop apps={APPS} defaultOpen={["workbench"]} />);
    await openHelp(user);
    await user.keyboard("blur");
    await user.click(await screen.findByRole("menuitem", { name: "Tools ▸ Effects ▸ Blur" }));
    expect(await screen.findByRole("menuitem", { name: "Blur" })).toBeInTheDocument();
    await waitFor(() =>
      expect(document.querySelector(".mac-help-viewer-menu-arrow")).not.toBeNull(),
    );
    await user.keyboard("{Escape}");
  });

  it("finds the Help menu's own rows, without listing its results", async () => {
    const user = userEvent.setup();
    render(<CatalinaDesktop apps={APPS} defaultOpen={["workbench"]} />);
    await openHelp(user);
    await user.keyboard("workb");
    expect(await screen.findByRole("menuitem", { name: "Help ▸ Workbench Help" })).toBeVisible();
    await user.keyboard("e");
    expect(screen.getAllByRole("menuitem", { name: /^Help ▸/ })).toHaveLength(1);
    await user.keyboard("{Escape}");
  });

  it("keeps typing in the field while the pointer rests on a result", async () => {
    const user = userEvent.setup();
    render(<CatalinaDesktop apps={APPS} defaultOpen={["workbench"]} />);
    await openHelp(user);
    await user.keyboard("shar");
    await user.hover(await screen.findByRole("menuitem", { name: "Tools ▸ Sharpen" }));
    await user.keyboard("p");
    expect(field()).toHaveValue("sharp");
    expect(field()).toHaveFocus();
  });

  it("opens a topic it found in Help Viewer", async () => {
    const user = userEvent.setup();
    render(<CatalinaDesktop apps={APPS} defaultOpen={["workbench"]} />);
    await openHelp(user);
    await user.keyboard("encrypt mac data");
    await user.click(
      await screen.findByRole("menuitem", { name: "Encrypt Mac data with FileVault" }),
    );
    expect(
      await screen.findByRole("heading", { name: "Encrypt Mac data with FileVault" }),
    ).toBeInTheDocument();
  });

  it("opens on Shift-Command-? and lists the words in Help Viewer on Return", async () => {
    const user = userEvent.setup();
    render(<CatalinaDesktop apps={APPS} defaultOpen={["workbench"]} />);
    await user.keyboard("{Control>}{Shift>}?{/Shift}{/Control}");
    await waitFor(() => expect(field()).toHaveFocus());
    await user.keyboard("filevault{Enter}");
    expect(await screen.findByRole("heading", { name: "All Help" })).toBeInTheDocument();
    expect(screen.getAllByRole("searchbox")[0]).toHaveValue("filevault");
    expect(screen.queryByRole("menu")).toBeNull();
  });
});
