import { Dock, DockItem, DockSeparator } from "macalicious/dock";
import { ManagedWindow, useManagedWindow } from "macalicious/managed-window";
import { TitleBar } from "macalicious/title-bar";
import { WindowBody } from "macalicious/window";
import { WindowControls } from "macalicious/window-controls";
import { useWindowManager, WindowManager } from "macalicious/window-manager";
import { useState } from "react";

const APPS = [
  { id: "notes", name: "Notes", hue: 48 },
  { id: "reminders", name: "Reminders", hue: 12 },
  { id: "calculator", name: "Calculator", hue: 210 },
];

const wallpaper = "linear-gradient(light-dark(#7fb2d9, #25426e), light-dark(#062845, #081422))";

function Tile({ hue }: { hue: number }) {
  return (
    <span
      style={{
        width: 56,
        height: 56,
        borderRadius: 13,
        background: `linear-gradient(hsl(${hue} 65% 64%), hsl(${hue} 65% 44%))`,
      }}
    />
  );
}

/** A minimized window's tile: a small drawing of a window in the application's colour. */
function MiniWindow({ hue }: { hue: number }) {
  return (
    <span
      style={{
        width: 52,
        height: 38,
        borderRadius: 3,
        borderTop: `7px solid hsl(${hue} 30% 75%)`,
        background: "light-dark(#ececec, #323232)",
        boxShadow: "0 1px 3px rgb(0 0 0 / 0.4)",
      }}
    />
  );
}

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
 * The Dock of this desktop. It reads the windows from the manager, so it is a component of
 * its own, rendered inside the manager. Applications that have a window are running; every
 * minimized window gets a tile after the separator, and a click brings the window back.
 */
function DesktopDock({ onLaunch }: { onLaunch: (app: string) => void }) {
  const { windows, focus } = useWindowManager();
  return (
    <Dock>
      {APPS.map((app) => {
        const open = windows.find((window) => window.app === app.id);
        return (
          <DockItem
            key={app.id}
            label={app.name}
            icon={<Tile hue={app.hue} />}
            running={open !== undefined}
            onClick={() => (open ? focus(open.id) : onLaunch(app.id))}
          />
        );
      })}
      <DockSeparator />
      {windows
        .filter((window) => window.minimized)
        .map((window) => (
          <DockItem
            key={window.id}
            label={window.title}
            aria-label={`${window.title}, minimized window`}
            icon={<MiniWindow hue={APPS.find((app) => app.id === window.app)?.hue ?? 0} />}
            onClick={() => focus(window.id)}
          />
        ))}
      <DockItem label="Downloads" icon={<Tile hue={220} />} />
    </Dock>
  );
}

export default function WindowManagerDock() {
  const [open, setOpen] = useState<readonly string[]>(["notes", "reminders"]);
  const launch = (app: string) => setOpen((apps) => [...apps, app]);
  const quit = (app: string) => setOpen((apps) => apps.filter((id) => id !== app));

  return (
    <WindowManager
      insets={{ bottom: 80 }}
      style={{ width: "100%", height: 420, background: wallpaper }}
    >
      {APPS.map((app, index) => (
        <ManagedWindow
          key={app.id}
          id={app.id}
          app={app.id}
          title={app.name}
          open={open.includes(app.id)}
          onOpenChange={(isOpen) => (isOpen ? launch(app.id) : quit(app.id))}
          defaultFrame={{ x: 24 + index * 70, y: 20 + index * 40, width: 300, height: 180 }}
        >
          <Chrome title={app.name} />
          <WindowBody style={{ padding: 20 }}>
            Minimize this window and bring it back from its tile in the Dock, or close it and open
            it again from its application.
          </WindowBody>
        </ManagedWindow>
      ))}
      <DesktopDock onLaunch={launch} />
    </WindowManager>
  );
}
