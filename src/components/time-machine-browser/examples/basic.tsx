import { TimeMachineBrowser } from "macalicious/time-machine-browser";
import { TitleBar } from "macalicious/title-bar";
import { Window, WindowBody } from "macalicious/window";
import { WindowControls } from "macalicious/window-controls";

const backups = [
  { value: "mon", label: "Monday at 6:02 PM", mark: "Monday" },
  { value: "yesterday-1", label: "Yesterday at 10:17 AM", mark: "Yesterday" },
  { value: "yesterday-2", label: "Yesterday at 4:40 PM" },
  { value: "today-1", label: "Today at 9:12 AM", mark: "Today" },
  { value: "today-2", label: "Today at 3:34 PM" },
  { value: "now", label: "Now", caption: "Now" },
];

/** The browser fills the element it is given; the front window is its child. */
export default function Basic() {
  return (
    <div style={{ width: 720, maxWidth: "100%", height: 480 }}>
      <TimeMachineBrowser backups={backups} defaultValue="today-2" title="Downloads">
        <Window width={380} height={220}>
          <TitleBar title="Downloads" controls={<WindowControls minimizeDisabled zoomDisabled />} />
          <WindowBody background="content" style={{ padding: 16 }}>
            The folder as it was when the backup was made.
          </WindowBody>
        </Window>
      </TimeMachineBrowser>
    </div>
  );
}
