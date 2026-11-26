import { FullScreenWindow } from "macalicious/full-screen-window";
import { TitleBar } from "macalicious/title-bar";
import { WindowBody } from "macalicious/window";
import { WindowControls } from "macalicious/window-controls";

/** A stand-in for the screen's menu bar, which is a component of its own. */
const menuBar = {
  paddingInline: 16,
  background: "var(--mac-material-menu-bar)",
  color: "var(--mac-color-label)",
  font: "var(--mac-font-menu-bar)",
};

export default function Basic() {
  return (
    <FullScreenWindow
      height={220}
      menuBar={<div style={menuBar}>Application</div>}
      titleBar={
        <TitleBar
          variant="title-hidden"
          title="Albums"
          controls={<WindowControls zoomRole="exit-full-screen" minimizeDisabled />}
        />
      }
    >
      <WindowBody background="content" style={{ padding: 20 }}>
        Move the pointer to the top edge to bring the menu bar down.
      </WindowBody>
    </FullScreenWindow>
  );
}
