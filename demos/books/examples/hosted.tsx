import { ManagedWindow } from "macalicious/managed-window";
import { PushButton } from "macalicious/push-button";
import { WindowManager } from "macalicious/window-manager";
import { useState } from "react";
import { app } from "../app";

/**
 * What the desktop page does with the demo: it reads the descriptor and renders the component
 * in a managed window. Drag the window by its toolbar, resize it from its edges, minimize it,
 * or close it and open it again. A book opens as a second window inside the same manager.
 */
export default function Hosted() {
  const [open, setOpen] = useState(true);
  return (
    <div style={{ display: "grid", gap: 12, justifyItems: "start", width: "100%" }}>
      <PushButton disabled={open} onClick={() => setOpen(true)}>
        Open {app.name}
      </PushButton>
      <WindowManager style={{ width: "100%", height: 680 }}>
        <ManagedWindow
          id={app.id}
          app={app.id}
          title={app.name}
          resizable={app.resizable}
          minWidth={app.minSize.width}
          minHeight={app.minSize.height}
          defaultFrame={{ x: 24, y: 24, width: 900, height: 540 }}
          open={open}
          onOpenChange={setOpen}
          render={(props) => (
            <app.component
              bookOffset={{ x: 120, y: 40 }}
              readerProps={{ width: 620, height: 520 }}
              {...props}
            />
          )}
        />
      </WindowManager>
    </div>
  );
}
