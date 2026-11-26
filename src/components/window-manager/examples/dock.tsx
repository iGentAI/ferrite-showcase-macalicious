import { ManagedWindow, useManagedWindow } from "macalicious/managed-window";
import { PushButton } from "macalicious/push-button";
import { TitleBar } from "macalicious/title-bar";
import { WindowBody } from "macalicious/window";
import { WindowControls } from "macalicious/window-controls";
import { useWindowManager, WindowManager } from "macalicious/window-manager";
import { type CSSProperties, useState } from "react";

const APPS = [
  { id: "notes", name: "Notes" },
  { id: "reminders", name: "Reminders" },
  { id: "calculator", name: "Calculator" },
];

const dock: CSSProperties = {
  position: "absolute",
  zIndex: "var(--mac-window-manager-layer-chrome)",
  bottom: 8,
  left: "50%",
  transform: "translateX(-50%)",
  display: "flex",
  gap: 8,
  padding: 8,
  borderRadius: 10,
  background: "var(--mac-color-window-background)",
};

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
 * A stand-in Dock: one button per application. It reads the windows from the manager, so it is
 * a component of its own, rendered inside the manager.
 */
function Dock({ onLaunch }: { onLaunch: (app: string) => void }) {
  const { windows, keyWindowId, focus } = useWindowManager();
  return (
    <div style={dock} data-window-minimize-target="">
      {APPS.map((app) => {
        const open = windows.find((w) => w.app === app.id);
        const status = !open ? "" : open.minimized ? " (minimized)" : " (open)";
        return (
          <PushButton
            key={app.id}
            aria-pressed={open?.id === keyWindowId}
            onClick={() => (open ? focus(open.id) : onLaunch(app.id))}
          >
            {app.name}
            {status}
          </PushButton>
        );
      })}
    </div>
  );
}

export default function DockExample() {
  const [open, setOpen] = useState<readonly string[]>(["notes", "reminders"]);
  const launch = (app: string) => setOpen((apps) => [...apps, app]);
  const quit = (app: string) => setOpen((apps) => apps.filter((id) => id !== app));

  return (
    <WindowManager insets={{ bottom: 56 }} style={{ width: "100%", height: 380 }}>
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
            Minimize or close this window, then bring it back from the Dock.
          </WindowBody>
        </ManagedWindow>
      ))}
      <Dock onLaunch={launch} />
    </WindowManager>
  );
}
