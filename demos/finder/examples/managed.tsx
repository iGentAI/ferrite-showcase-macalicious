import { ManagedWindow } from "macalicious/managed-window";
import { WindowManager } from "macalicious/window-manager";
import { finderApp } from "../app";

/**
 * The app hosted by the library's window manager, as a desktop page does it: drag the window
 * by its title bar, resize it by its edges, zoom it with the green button.
 */
export default function Managed() {
  return (
    <WindowManager style={{ width: "100%", height: 600 }}>
      <ManagedWindow
        id={finderApp.id}
        title={finderApp.name}
        defaultFrame={{ x: 24, y: 20, width: 860, height: 520 }}
        minWidth={finderApp.minSize.width}
        minHeight={finderApp.minSize.height}
        render={(props) => <finderApp.component {...props} material="opaque" />}
      />
    </WindowManager>
  );
}
