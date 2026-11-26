import {
  MissionControl,
  MissionControlSpace,
  MissionControlWindow,
} from "macalicious/mission-control";
import { PushButton } from "macalicious/push-button";
import { type CSSProperties, useState } from "react";

// The open windows: where each one is on the desktop, in points.
const WINDOWS = [
  { title: "Notes", color: "yellow", frame: { x: 40, y: 50, width: 420, height: 300 } },
  { title: "Maps", color: "green", frame: { x: 300, y: 120, width: 520, height: 340 } },
  { title: "Calculator", color: "orange", frame: { x: 640, y: 40, width: 232, height: 320 } },
];

const wallpaper =
  "linear-gradient(160deg, var(--mac-color-system-teal), var(--mac-color-system-indigo))";

// The desktop Mission Control covers: a positioned element. Mission Control paints the
// desktop picture again over whatever is on it.
const desktop = {
  position: "relative",
  width: "100%",
  height: 420,
  padding: 20,
  boxSizing: "border-box",
  overflow: "hidden",
  background: wallpaper,
  "--mac-mission-control-desktop": wallpaper,
  "--mac-mission-control-inset-bottom": "0px",
} as CSSProperties;

/** A stand-in for a picture of a window: a coloured title bar over a plain body. */
function Picture({ color }: { color: string }) {
  return (
    <div
      style={{
        height: "100%",
        background: `linear-gradient(var(--mac-color-system-${color}) 22px, var(--mac-color-window-background) 22px)`,
      }}
    />
  );
}

export default function Basic() {
  const [element, setElement] = useState<HTMLDivElement | null>(null);
  const [open, setOpen] = useState(false);
  const [desktops, setDesktops] = useState(2);
  const [front, setFront] = useState("Nothing chosen yet.");

  return (
    <div ref={setElement} style={desktop}>
      <PushButton onClick={() => setOpen(true)}>Show Mission Control</PushButton>
      <p style={{ color: "white" }}>{front}</p>
      <MissionControl
        open={open}
        onOpenChange={setOpen}
        container={element}
        onAddSpace={() => setDesktops(desktops + 1)}
        spaces={Array.from({ length: desktops }, (_, index) => (
          <MissionControlSpace
            // biome-ignore lint/suspicious/noArrayIndexKey: desktops are only ever added at the end
            key={index}
            label={`Desktop ${index + 1}`}
            current={index === 0}
          >
            <span style={{ background: wallpaper }} />
          </MissionControlSpace>
        ))}
      >
        {WINDOWS.map((window) => (
          <MissionControlWindow
            key={window.title}
            title={window.title}
            frame={window.frame}
            onClick={() => setFront(`${window.title} is in front.`)}
          >
            <Picture color={window.color} />
          </MissionControlWindow>
        ))}
      </MissionControl>
    </div>
  );
}
