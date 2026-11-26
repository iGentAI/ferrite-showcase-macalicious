import { ManagedWindow, type ManagedWindowRenderProps } from "macalicious/managed-window";
import { TitleBar } from "macalicious/title-bar";
import { Window, WindowBody } from "macalicious/window";
import { WindowControls } from "macalicious/window-controls";
import { WindowManager } from "macalicious/window-manager";

/**
 * An application written as one component with a Window as its root. It knows nothing of the
 * manager: it takes the Window's props, and the props of its title bar and window controls,
 * which it takes out before the rest goes to the Window.
 */
function Clock({
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
    <Window {...windowProps}>
      <TitleBar
        title="Clock"
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
      <WindowBody
        style={{ display: "grid", placeItems: "center", font: "var(--mac-font-title-1)" }}
      >
        9:41
      </WindowBody>
    </Window>
  );
}

export default function Render() {
  return (
    <WindowManager style={{ width: "100%", height: 240 }}>
      <ManagedWindow
        id="clock"
        title="Clock"
        resizable={false}
        defaultFrame={{ x: 40, y: 30, width: 200, height: 140 }}
        render={(props) => <Clock {...props} />}
      />
    </WindowManager>
  );
}
