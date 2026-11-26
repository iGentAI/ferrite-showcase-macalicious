import { ManagedWindow } from "macalicious/managed-window";
import { WindowManager } from "macalicious/window-manager";
import { useState } from "react";
import { app } from "../app";

/**
 * What a desktop page does with the demo: it reads the descriptor and renders the component in
 * a managed window. Drag the window by its title bar, resize it by its edges, and open a
 * dialog with Command-O, Command-S or Command-P (Control off a Mac) while the document has
 * the keyboard. The Open panel is put into the desktop, so it is centred on it.
 */
export default function Hosted() {
  const [desktop, setDesktop] = useState<HTMLDivElement | null>(null);
  return (
    <div ref={setDesktop} style={{ position: "relative", width: "100%" }}>
      <WindowManager style={{ height: 640 }}>
        <ManagedWindow
          id={app.id}
          app={app.id}
          title={app.name}
          resizable={app.resizable}
          minWidth={app.minSize.width}
          minHeight={app.minSize.height}
          defaultFrame={{ x: 24, y: 20, ...app.defaultSize }}
          render={(props) => <app.component {...props} panelContainer={desktop} />}
        />
      </WindowManager>
    </div>
  );
}
