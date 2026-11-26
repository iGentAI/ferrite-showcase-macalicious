import { AppSwitcher, AppSwitcherItem } from "macalicious/app-switcher";
import { PushButton } from "macalicious/push-button";
import { type CSSProperties, useState } from "react";

const APPS = [
  { id: "finder", name: "Finder", color: "#4a90d9" },
  { id: "calendar", name: "Calendar", color: "#d9534a" },
  { id: "music", name: "Music", color: "#c75fb1" },
  { id: "photos", name: "Photos", color: "#6dbb63" },
];

/**
 * The selection held by the caller: the switcher opens on the application named in `value`,
 * and every move of the selection is reported. Smaller icons through
 * `--mac-app-switcher-icon-size`.
 */
export default function Controlled() {
  const [open, setOpen] = useState(false);
  const [value, setValue] = useState("calendar");
  const [front, setFront] = useState("finder");
  return (
    <div
      style={{
        position: "relative",
        width: "100%",
        height: 220,
        padding: 20,
        boxSizing: "border-box",
        background: "var(--mac-color-window-background)",
        color: "var(--mac-color-label)",
        font: "var(--mac-font-body)",
      }}
    >
      <PushButton onClick={() => setOpen(true)}>Switch Application</PushButton>
      <p>
        Selected: {value}. In front: {front}.
      </p>
      <AppSwitcher
        open={open}
        onOpenChange={setOpen}
        value={value}
        onValueChange={setValue}
        onChoose={setFront}
        style={{ "--mac-app-switcher-icon-size": "64px" } as CSSProperties}
      >
        {APPS.map((app) => (
          <AppSwitcherItem
            key={app.id}
            value={app.id}
            icon={<div style={{ scale: "0.84", borderRadius: 14, background: app.color }} />}
          >
            {app.name}
          </AppSwitcherItem>
        ))}
      </AppSwitcher>
    </div>
  );
}
