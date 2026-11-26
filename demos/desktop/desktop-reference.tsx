"use client";

import type { ManagedWindowRenderProps } from "macalicious/managed-window";
import { TitleBar } from "macalicious/title-bar";
import { Window, WindowBody } from "macalicious/window";
import { WindowControls } from "macalicious/window-controls";
import { CatalinaDesktop, type CatalinaDesktopProps } from "./desktop";
import type { DesktopApp } from "./desktop-apps";

/**
 * The applications in the Dock of the Desktop screenshots, in their order, after Finder and
 * Launchpad, which are the desktop's own tiles.
 */
const NAMES = [
  "Safari",
  "Mail",
  "FaceTime",
  "Messages",
  "Maps",
  "Photos",
  "Contacts",
  "Calendar",
  "Reminders",
  "Notes",
  "Music",
  "Podcasts",
  "TV",
  "News",
  "App Store",
  "System Preferences",
];

/** An application that is a name and an empty window: it stands in a Dock, and opens. */
function standIn(name: string): DesktopApp {
  function StandIn({
    onClose,
    onMinimize,
    onZoom,
    zoomRole,
    minimizeDisabled,
    zoomDisabled,
    onDragRegionPointerDown,
    onDragRegionDoubleClick,
    ...windowProps
  }: ManagedWindowRenderProps) {
    return (
      <Window {...windowProps}>
        <TitleBar
          title={name}
          controls={
            <WindowControls
              onClose={onClose}
              onMinimize={onMinimize}
              onZoom={onZoom}
              zoomRole={zoomRole}
              minimizeDisabled={minimizeDisabled}
              zoomDisabled={zoomDisabled}
            />
          }
          onDragRegionPointerDown={onDragRegionPointerDown}
          onDragRegionDoubleClick={onDragRegionDoubleClick}
        />
        <WindowBody />
      </Window>
    );
  }
  return {
    id: name.toLowerCase().replace(/\s+/g, "-"),
    name,
    component: StandIn,
    defaultSize: { width: 480, height: 320 },
    menus: [name, "File", "Edit", "View", "Window", "Help"],
  };
}

const REFERENCE_APPS: readonly DesktopApp[] = NAMES.map(standIn);

/**
 * The desktop as the Desktop and Apple-Menu screenshots show it, for the visual comparisons:
 * the 1680 by 1050 pt screen with Finder in front, the Dock of the capture (Finder, Launchpad,
 * sixteen applications that are stand-ins with the captured names, the Downloads stack and
 * the Trash), the two volumes and no stacks. `clock` is the capture's time.
 *
 * The generated island photographs are left out: the menu bar, the Apple menu and the Dock are
 * translucent, and their comparisons are measured over the stand-in drawing beneath the
 * photographs (`--mac-desktop-shell-picture`), so no pixel of generated artwork is compared.
 */
export function ReferenceDesktop({ style, className, ...props }: CatalinaDesktopProps) {
  return (
    <CatalinaDesktop
      className={
        className ? `mac-desktop-shell-reference ${className}` : "mac-desktop-shell-reference"
      }
      apps={REFERENCE_APPS}
      stacks={false}
      style={{ width: 1680, height: 1050, ...style }}
      {...props}
    />
  );
}
