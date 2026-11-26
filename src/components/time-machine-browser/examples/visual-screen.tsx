import { type TimeMachineBackup, TimeMachineBrowser } from "macalicious/time-machine-browser";
import { TitleBar } from "macalicious/title-bar";
import { Window, WindowBody } from "macalicious/window";
import { WindowControls } from "macalicious/window-controls";
import type { CSSProperties } from "react";

const plain = (prefix: string, count: number): TimeMachineBackup[] =>
  Array.from({ length: count }, (_, n) => ({
    value: `${prefix}-${n}`,
    label: `${prefix} ${n}`,
  }));

/** The timeline of the Aqua capture: six backups today before the one shown, then Now. */
const LIGHT: TimeMachineBackup[] = [
  { value: "first", label: "Today at 8:34 AM", mark: "Today" },
  ...plain("Today", 5),
  { value: "shown", label: "Today at 3:34 PM" },
  { value: "now", label: "Now", caption: "Now" },
];

/** The timeline of the Dark Aqua capture: the oldest backup is shown. */
const DARK: TimeMachineBackup[] = [
  { value: "shown", label: "Yesterday at 10:17 AM", mark: "Yesterday" },
  ...plain("Yesterday", 8),
  { value: "today", label: "Today at 9:17 AM", mark: "Today" },
  { value: "today-2", label: "Today at 10:17 AM" },
  { value: "now", label: "Now", caption: "Now" },
];

export interface VisualScreenProps {
  /** The Dark Aqua capture: a 770 x 436 pt window on the oldest backup. */
  dark?: boolean;
  /** The part of the 1680 x 1050 pt screen to show, in points: x, y, width, height. */
  crop: [number, number, number, number];
  /** What is behind that part: the colours measured in the capture, as a CSS background. */
  backdrop: string;
  /**
   * The front window casts no shadow: for the parts beside and under the window, where the
   * colours measured in the capture already hold the shadow of the window in it.
   */
  flat?: boolean;
}

/**
 * One part of the Time Machine screen of the reference captures, for the `visual-*` examples.
 * The browser is laid out on the whole 1680 x 1050 pt screen and clipped to `crop`. The
 * blurred desktop picture is not reproduced: `backdrop` paints the colours measured around the
 * part, and the browser's own backdrop is switched off so that its buttons and ticks are
 * added to those colours.
 *
 * macOS puts a window on whole points: the 603 pt window of the Aqua capture, which centring
 * would start at 280.5 pt, starts at 281. CSS centres on the half point, so the Aqua screen
 * is given the missing half point at the top.
 */
export function VisualScreen({ dark = false, crop, backdrop, flat = false }: VisualScreenProps) {
  const [x, y, width, height] = crop;
  return (
    <div style={{ position: "relative", overflow: "hidden", width, height, background: backdrop }}>
      <TimeMachineBrowser
        backups={dark ? DARK : LIGHT}
        defaultValue="shown"
        title="Downloads"
        style={
          {
            position: "absolute",
            left: -x,
            top: -y,
            width: 1680,
            height: 1050,
            paddingBlockStart: dark ? undefined : 115,
            "--mac-time-machine-browser-backdrop": "none",
          } as CSSProperties
        }
      >
        <Window width={dark ? 770 : 958} height={dark ? 436 : 603} fullScreen={flat}>
          <TitleBar title="Downloads" controls={<WindowControls minimizeDisabled zoomDisabled />} />
          <WindowBody background="content" />
        </Window>
      </TimeMachineBrowser>
    </div>
  );
}

/** The whole screen of the Aqua capture, on the browser's own placeholder backdrop. */
export default function VisualScreenLight() {
  return (
    <div style={{ width: 1680, height: 1050 }}>
      <TimeMachineBrowser backups={LIGHT} defaultValue="shown" title="Downloads">
        <Window width={958} height={603}>
          <TitleBar title="Downloads" controls={<WindowControls minimizeDisabled zoomDisabled />} />
          <WindowBody background="content" />
        </Window>
      </TimeMachineBrowser>
    </div>
  );
}
