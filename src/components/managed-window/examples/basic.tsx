import { ManagedWindow, useManagedWindow } from "macalicious/managed-window";
import { PushButton } from "macalicious/push-button";
import { TitleBar } from "macalicious/title-bar";
import { WindowBody } from "macalicious/window";
import { WindowControls } from "macalicious/window-controls";
import { WindowManager } from "macalicious/window-manager";

/** The window's content: a title bar wired to the manager, and its commands as buttons. */
function Content() {
  const managed = useManagedWindow();
  return (
    <>
      <TitleBar
        title="Untitled"
        controls={<WindowControls {...managed.controlsProps} />}
        {...managed.titleBarProps}
      />
      <WindowBody style={{ padding: 20, display: "flex", gap: 12, alignItems: "start" }}>
        <PushButton onClick={managed.zoom}>{managed.zoomed ? "Unzoom" : "Zoom"}</PushButton>
        <PushButton onClick={managed.toggleFullScreen}>
          {managed.fullScreen ? "Exit Full Screen" : "Full Screen"}
        </PushButton>
      </WindowBody>
    </>
  );
}

export default function Basic() {
  return (
    <WindowManager style={{ width: "100%", height: 300 }}>
      <ManagedWindow
        title="Untitled"
        defaultFrame={{ x: 40, y: 30, width: 340, height: 180 }}
        minWidth={260}
        minHeight={120}
      >
        <Content />
      </ManagedWindow>
    </WindowManager>
  );
}
