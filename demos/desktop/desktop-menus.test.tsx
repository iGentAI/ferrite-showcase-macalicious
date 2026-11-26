import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ManagedWindowRenderProps } from "macalicious/managed-window";
import { MenuItem } from "macalicious/menu-item";
import { TitleBar } from "macalicious/title-bar";
import { Window, WindowBody } from "macalicious/window";
import { describe, expect, it } from "vitest";
import { CatalinaDesktop } from "./desktop";
import { useDesktopAppMenu } from "./desktop-app-menus";
import type { DesktopApp } from "./desktop-apps";

/*
 * The front application's menus in the menu bar: the items its window registers, and the
 * desktop's own rows. A menu the desktop has no commands for (History, Bookmarks, Tools) holds
 * the registered items alone; its dimmed "This demo has no … commands" row is only for an
 * application that registered nothing there (desktop.test.tsx holds that case).
 */

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
  useDesktopAppMenu("workbench", "Tools", <MenuItem>Sharpen</MenuItem>);
  useDesktopAppMenu("workbench", "File", <MenuItem>Export</MenuItem>);
  return (
    <Window {...windowProps}>
      <TitleBar title="Workbench" />
      <WindowBody>
        <button type="button">Workbench button</button>
      </WindowBody>
    </Window>
  );
}

const APPS: DesktopApp[] = [
  {
    id: "workbench",
    name: "Workbench",
    component: Workbench,
    defaultSize: { width: 400, height: 300 },
    menus: ["Workbench", "File", "Tools", "Window"],
  },
];

describe("the front application's menus", () => {
  it("shows an application's own items alone in a menu the desktop has no commands for", async () => {
    const user = userEvent.setup();
    render(<CatalinaDesktop apps={APPS} defaultOpen={["workbench"]} />);
    await user.click(screen.getByRole("menuitem", { name: "Tools" }));
    expect(await screen.findByRole("menuitem", { name: "Sharpen" })).toBeInTheDocument();
    expect(screen.queryByRole("menuitem", { name: /has no Tools commands/ })).toBeNull();
    // The menu holds the one item, with no separator under it (the Dock has one of its own).
    expect(within(screen.getByRole("menu")).queryByRole("separator")).toBeNull();
  });

  it("keeps the desktop's own commands under the registered items of a menu it knows", async () => {
    const user = userEvent.setup();
    render(<CatalinaDesktop apps={APPS} defaultOpen={["workbench"]} />);
    await user.click(screen.getByRole("menuitem", { name: "File" }));
    expect(await screen.findByRole("menuitem", { name: "Export" })).toBeInTheDocument();
    expect(screen.getByRole("menuitem", { name: /Close Window/ })).toBeInTheDocument();
  });
});
