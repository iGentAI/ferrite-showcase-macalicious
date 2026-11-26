import { Checkbox } from "macalicious/checkbox";
import { ManagedWindow, useManagedWindow } from "macalicious/managed-window";
import { TitleBar } from "macalicious/title-bar";
import { WindowBody } from "macalicious/window";
import { WindowControls } from "macalicious/window-controls";
import { WindowManager } from "macalicious/window-manager";

function Chrome({ title, utility = false }: { title: string; utility?: boolean }) {
  const managed = useManagedWindow();
  return (
    <TitleBar
      title={title}
      variant={utility ? "utility" : "standard"}
      controls={<WindowControls size={utility ? "small" : "regular"} {...managed.controlsProps} />}
      {...managed.titleBarProps}
    />
  );
}

/**
 * A document window and its inspector panel. Press the panel: it becomes key and the document
 * stays main, with an active frame and grey window controls. The panel is always in front.
 */
export default function Panel() {
  return (
    <WindowManager style={{ width: "100%", height: 300 }}>
      <ManagedWindow title="Document" defaultFrame={{ x: 24, y: 24, width: 340, height: 220 }}>
        <Chrome title="Document" />
        <WindowBody background="content" style={{ padding: 20 }}>
          The document window.
        </WindowBody>
      </ManagedWindow>
      <ManagedWindow
        panel
        title="Inspector"
        zoomButton="zoom"
        resizable={false}
        defaultFrame={{ x: 280, y: 80, width: 180, height: 150 }}
      >
        <Chrome title="Inspector" utility />
        <WindowBody style={{ padding: 12 }}>
          <Checkbox defaultChecked>Wrap to page</Checkbox>
        </WindowBody>
      </ManagedWindow>
    </WindowManager>
  );
}
