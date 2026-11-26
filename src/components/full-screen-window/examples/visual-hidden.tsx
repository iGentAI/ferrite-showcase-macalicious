import { FullScreenWindow } from "macalicious/full-screen-window";
import { TitleBar } from "macalicious/title-bar";
import { WindowBody } from "macalicious/window";
import { WindowControls } from "macalicious/window-controls";

/**
 * Visual state target: a full-screen window whose bars are hidden, 240 x 120 pt. The state
 * checks reveal them with the pointer at the top edge and with Tab, which no screenshot can
 * show. The menu bar's slot is a flat grey stand-in, so that its place can be read.
 */
export default function VisualHidden() {
  return (
    <div style={{ width: 240, height: 120 }}>
      <FullScreenWindow
        autoHideToolbar
        aria-label="Document"
        height={120}
        menuBar={<div style={{ background: "#808080" }} />}
        titleBar={
          <TitleBar
            variant="title-hidden"
            controls={<WindowControls zoomRole="exit-full-screen" minimizeDisabled />}
          />
        }
      >
        <WindowBody background="content" />
      </FullScreenWindow>
    </div>
  );
}
