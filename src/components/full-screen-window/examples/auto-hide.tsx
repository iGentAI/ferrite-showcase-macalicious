import { FullScreenWindow } from "macalicious/full-screen-window";
import { TitleBar } from "macalicious/title-bar";
import { WindowBody } from "macalicious/window";
import { WindowControls } from "macalicious/window-controls";

const menuBar = {
  paddingInline: 16,
  background: "var(--mac-material-menu-bar)",
  color: "var(--mac-color-label)",
  font: "var(--mac-font-menu-bar)",
};

/**
 * A window whose title bar hides with the menu bar, as a document viewer's does: nothing but
 * the content until the pointer reaches the top edge, or Tab moves focus to a window control.
 */
export default function AutoHide() {
  return (
    <FullScreenWindow
      autoHideToolbar
      height={220}
      menuBar={<div style={menuBar}>Application</div>}
      titleBar={
        <TitleBar
          title="Document"
          controls={<WindowControls zoomRole="exit-full-screen" minimizeDisabled />}
        />
      }
    >
      <WindowBody background="content" style={{ padding: 20 }}>
        The content starts at the top of the screen. The bars slide over it.
      </WindowBody>
    </FullScreenWindow>
  );
}
