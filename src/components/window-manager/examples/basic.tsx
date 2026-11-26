import { ManagedWindow, useManagedWindow } from "macalicious/managed-window";
import { PushButton } from "macalicious/push-button";
import { TitleBar } from "macalicious/title-bar";
import { WindowBody } from "macalicious/window";
import { WindowControls } from "macalicious/window-controls";
import { WindowManager } from "macalicious/window-manager";

/** A title bar wired to the manager: drag to move, double-click to zoom, working controls. */
function Chrome({ title }: { title: string }) {
  const managed = useManagedWindow();
  return (
    <TitleBar
      title={title}
      controls={<WindowControls {...managed.controlsProps} />}
      {...managed.titleBarProps}
    />
  );
}

export default function Basic() {
  return (
    <WindowManager style={{ width: "100%", height: 340 }}>
      <ManagedWindow title="First" defaultFrame={{ x: 24, y: 24, width: 280, height: 170 }}>
        <Chrome title="First" />
        <WindowBody style={{ padding: 20 }}>Press a window to bring it to the front.</WindowBody>
      </ManagedWindow>
      <ManagedWindow title="Second" defaultFrame={{ x: 170, y: 110, width: 300, height: 180 }}>
        <Chrome title="Second" />
        <WindowBody style={{ padding: 20, display: "grid", gap: 12, justifyItems: "end" }}>
          <span style={{ justifySelf: "start" }}>Drag the title bar, or an edge or corner.</span>
          <PushButton variant="primary">OK</PushButton>
        </WindowBody>
      </ManagedWindow>
    </WindowManager>
  );
}
