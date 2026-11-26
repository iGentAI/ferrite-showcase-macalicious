import { AppSwitcher, AppSwitcherItem } from "macalicious/app-switcher";
import { ManagedWindow, useManagedWindow } from "macalicious/managed-window";
import { PushButton } from "macalicious/push-button";
import { TitleBar } from "macalicious/title-bar";
import { WindowBody } from "macalicious/window";
import { WindowControls } from "macalicious/window-controls";
import { useWindowManager, WindowManager } from "macalicious/window-manager";
import { useState } from "react";

const APPS = [
  { id: "notes", name: "Notes", color: "#e9c46a" },
  { id: "mail", name: "Mail", color: "#4a90d9" },
  { id: "terminal", name: "Terminal", color: "#3a3a3c" },
];

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
 * The switcher fed from the window manager. It reads the windows with `useWindowManager()`, so
 * it is a component of its own inside the manager. The manager lists windows in the order
 * they were last key, the key window last: the applications in reverse are the most recently
 * used first, which is the switcher's order. Choosing one focuses its front window.
 */
function Switcher({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const { windows, focus } = useWindowManager();
  const running = [...new Set(windows.map((w) => w.app).reverse())];
  return (
    <AppSwitcher
      open={open}
      onOpenChange={onOpenChange}
      onChoose={(app) => {
        const front = windows.findLast((w) => w.app === app);
        if (front) focus(front.id);
      }}
    >
      {running.map((id) => {
        const app = APPS.find((a) => a.id === id);
        return (
          <AppSwitcherItem
            key={id}
            value={id}
            icon={<div style={{ scale: "0.84", borderRadius: 28, background: app?.color }} />}
          >
            {app?.name ?? id}
          </AppSwitcherItem>
        );
      })}
    </AppSwitcher>
  );
}

export default function WindowManagerExample() {
  const [open, setOpen] = useState(false);
  return (
    <WindowManager
      style={{ width: "100%", height: 400 }}
      // A page cannot have Command-Tab: Control-Option-Tab opens the switcher here.
      onKeyDown={(event) => {
        if (event.key === "Tab" && event.ctrlKey && event.altKey) {
          event.preventDefault();
          setOpen(true);
        }
      }}
    >
      {APPS.map((app, index) => (
        <ManagedWindow
          key={app.id}
          id={app.id}
          app={app.id}
          title={app.name}
          defaultFrame={{ x: 24 + index * 90, y: 50 + index * 36, width: 300, height: 180 }}
        >
          <Chrome title={app.name} />
          <WindowBody style={{ padding: 20 }}>{app.name}</WindowBody>
        </ManagedWindow>
      ))}
      <PushButton
        style={{
          position: "absolute",
          zIndex: "var(--mac-window-manager-layer-chrome)",
          top: 12,
          left: 12,
        }}
        onClick={() => setOpen(true)}
      >
        Switch Application
      </PushButton>
      <Switcher open={open} onOpenChange={setOpen} />
    </WindowManager>
  );
}
