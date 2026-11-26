import { ManagedWindow } from "macalicious/managed-window";
import { PushButton } from "macalicious/push-button";
import { WindowManager } from "macalicious/window-manager";
import { useState } from "react";
import { app } from "../app";

/**
 * What the desktop page does with the demo: it reads the descriptor and renders the component
 * in a managed window. Drag the window by its toolbar, resize it by its edges down to the
 * descriptor's smallest size, minimize it, or close it and open it again. It opens smaller
 * than the captured frame here, to fit the page.
 */
export default function Hosted() {
  const [open, setOpen] = useState(true);
  return (
    <div style={{ display: "grid", gap: 12, justifyItems: "start", width: "100%" }}>
      <PushButton disabled={open} onClick={() => setOpen(true)}>
        Open {app.name}
      </PushButton>
      <WindowManager style={{ justifySelf: "stretch", height: 600 }}>
        <ManagedWindow
          id={app.id}
          app={app.id}
          title={app.name}
          resizable={app.resizable}
          minWidth={app.minSize.width}
          minHeight={app.minSize.height}
          defaultFrame={{ x: 16, y: 16, width: 760, height: 540 }}
          open={open}
          onOpenChange={setOpen}
          render={(props) => <app.component {...props} />}
        />
      </WindowManager>
    </div>
  );
}
