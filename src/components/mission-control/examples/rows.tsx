import {
  MissionControl,
  MissionControlSpace,
  MissionControlWindow,
} from "macalicious/mission-control";
import { PushButton } from "macalicious/push-button";
import { type CSSProperties, useState } from "react";

const COLORS = ["blue", "green", "orange", "pink", "purple", "red", "teal", "yellow"];

// Eight windows of one size, cascaded 24 points apart as a window manager opens them.
const WINDOWS = COLORS.map((color, index) => ({
  title: `Document ${index + 1}`,
  color,
  frame: { x: 40 + index * 24, y: 30 + index * 24, width: 480, height: 320 },
}));

const wallpaper =
  "linear-gradient(160deg, var(--mac-color-system-orange), var(--mac-color-system-purple))";

const desktop = {
  position: "relative",
  width: "100%",
  height: 460,
  padding: 20,
  boxSizing: "border-box",
  overflow: "hidden",
  background: wallpaper,
  "--mac-mission-control-desktop": wallpaper,
  "--mac-mission-control-inset-bottom": "0px",
} as CSSProperties;

/** A stand-in application icon: a rounded square in a system colour. Use your own artwork. */
function Icon({ color }: { color: string }) {
  return <span style={{ borderRadius: "22%", background: `var(--mac-color-system-${color})` }} />;
}

/**
 * Eight overlapping windows. Mission Control lays them out in rows, none over another, and
 * shows each window's icon and title under the pointer or the keyboard focus.
 */
export default function Rows() {
  const [element, setElement] = useState<HTMLDivElement | null>(null);
  const [open, setOpen] = useState(false);

  return (
    <div ref={setElement} style={desktop}>
      <PushButton onClick={() => setOpen(true)}>Show Mission Control</PushButton>
      <MissionControl
        open={open}
        onOpenChange={setOpen}
        container={element}
        spaces={
          <>
            <MissionControlSpace label="Desktop 1">
              <span style={{ background: "var(--mac-color-system-gray)" }} />
            </MissionControlSpace>
            <MissionControlSpace label="Desktop 2" current>
              <span style={{ background: wallpaper }} />
            </MissionControlSpace>
          </>
        }
      >
        {WINDOWS.map((window) => (
          <MissionControlWindow
            key={window.title}
            title={window.title}
            frame={window.frame}
            icon={<Icon color={window.color} />}
          >
            <div
              style={{
                height: "100%",
                background: `linear-gradient(var(--mac-color-system-${window.color}) 22px, var(--mac-color-window-background) 22px)`,
              }}
            />
          </MissionControlWindow>
        ))}
      </MissionControl>
    </div>
  );
}
