import { ManagedWindow, useManagedWindow } from "macalicious/managed-window";
import {
  MissionControl,
  MissionControlSpace,
  MissionControlWindow,
} from "macalicious/mission-control";
import { PushButton } from "macalicious/push-button";
import { TitleBar } from "macalicious/title-bar";
import { WindowBody } from "macalicious/window";
import { WindowControls } from "macalicious/window-controls";
import { useWindowManager, WindowManager } from "macalicious/window-manager";
import { type CSSProperties, useState } from "react";

const APPS = [
  { id: "notes", name: "Notes" },
  { id: "reminders", name: "Reminders" },
  { id: "calendar", name: "Calendar" },
];

const wallpaper =
  "linear-gradient(160deg, var(--mac-color-system-teal), var(--mac-color-system-indigo))";

const desktop = {
  width: "100%",
  height: 440,
  background: wallpaper,
  "--mac-mission-control-desktop": wallpaper,
  "--mac-mission-control-inset-bottom": "0px",
} as CSSProperties;

function Chrome({ title }: { title: string }) {
  const managed = useManagedWindow();
  return (
    <TitleBar
      title={title}
      controls={<WindowControls {...managed.controlsProps} />}
      {...managed.titleBarProps}
    />
  );
}

/**
 * Mission Control fed by the window manager. It reads the windows with `useWindowManager()`,
 * so it is a component of its own, rendered inside the manager: every window that is not
 * minimized becomes a thumbnail at the window's frame, and choosing one brings that window
 * to the front with `focus(id)`. The thumbnails show stand-in pictures.
 */
function Overview({ container }: { container: HTMLElement | null }) {
  const { windows, focus } = useWindowManager();
  const [open, setOpen] = useState(false);

  return (
    <>
      <PushButton
        style={{ position: "absolute", bottom: 12, left: 12 }}
        onClick={() => setOpen(true)}
      >
        Mission Control
      </PushButton>
      <MissionControl
        open={open}
        onOpenChange={setOpen}
        container={container}
        spaces={
          <MissionControlSpace label="Desktop 1" current>
            <span style={{ background: wallpaper }} />
          </MissionControlSpace>
        }
      >
        {windows
          .filter((window) => !window.minimized)
          .map((window) => (
            <MissionControlWindow
              key={window.id}
              title={window.title}
              frame={window.frame}
              onClick={() => focus(window.id)}
            >
              <div
                style={{
                  height: "100%",
                  background:
                    "linear-gradient(var(--mac-color-system-gray) 22px, var(--mac-color-window-background) 22px)",
                }}
              />
            </MissionControlWindow>
          ))}
      </MissionControl>
    </>
  );
}

export default function WindowManagerExample() {
  const [element, setElement] = useState<HTMLDivElement | null>(null);

  return (
    <WindowManager ref={setElement} style={desktop}>
      {APPS.map((app, index) => (
        <ManagedWindow
          key={app.id}
          id={app.id}
          app={app.id}
          title={app.name}
          defaultFrame={{ x: 24 + index * 110, y: 20 + index * 50, width: 300, height: 190 }}
        >
          <Chrome title={app.name} />
          <WindowBody style={{ padding: 20 }}>
            Show Mission Control, then choose a window to bring it to the front.
          </WindowBody>
        </ManagedWindow>
      ))}
      <Overview container={element} />
    </WindowManager>
  );
}
