import { FullScreenWindow } from "macalicious/full-screen-window";
import { ManagedWindow, type ManagedWindowRenderProps } from "macalicious/managed-window";
import { TitleBar } from "macalicious/title-bar";
import { WindowBody } from "macalicious/window";
import { WindowControls } from "macalicious/window-controls";
import { WindowManager } from "macalicious/window-manager";

const menuBar = {
  paddingInline: 16,
  background: "var(--mac-material-menu-bar)",
  color: "var(--mac-color-label)",
  font: "var(--mac-font-menu-bar)",
};

/**
 * An application whose root is a FullScreenWindow. The manager's props for the window go to
 * it, `fullScreen` among them, so the same tree is an ordinary window until the green button
 * is clicked and a full-screen one after; the rest wires the title bar and window controls.
 */
function Viewer({
  onClose,
  onMinimize,
  onZoom,
  zoomRole,
  minimizeDisabled,
  zoomDisabled,
  onDragRegionPointerDown,
  onDragRegionDoubleClick,
  ...windowProps
}: ManagedWindowRenderProps) {
  return (
    <FullScreenWindow
      {...windowProps}
      autoHideToolbar
      menuBar={<div style={menuBar}>Viewer</div>}
      titleBar={
        <TitleBar
          title="Viewer"
          controls={
            <WindowControls
              onClose={onClose}
              onMinimize={onMinimize}
              onZoom={onZoom}
              zoomRole={zoomRole}
              minimizeDisabled={minimizeDisabled}
              zoomDisabled={zoomDisabled}
            />
          }
          onDragRegionPointerDown={onDragRegionPointerDown}
          onDragRegionDoubleClick={onDragRegionDoubleClick}
        />
      }
    >
      <WindowBody background="content" style={{ padding: 20 }}>
        {windowProps.fullScreen
          ? "Full screen. The green button is in the title bar, at the top edge."
          : "Click the green button to enter full screen."}
      </WindowBody>
    </FullScreenWindow>
  );
}

export default function Managed() {
  return (
    <WindowManager style={{ width: "100%", height: 300 }}>
      <ManagedWindow
        id="viewer"
        title="Viewer"
        defaultFrame={{ x: 40, y: 30, width: 340, height: 180 }}
        render={(props) => <Viewer {...props} />}
      />
    </WindowManager>
  );
}
