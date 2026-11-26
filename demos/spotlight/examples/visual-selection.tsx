import { CatalinaSpotlight } from "../spotlight";

/**
 * Visual comparison target: the selected top hit of the Aqua capture, the row "macOS" of the
 * search for "OS X", 288 x 22 pt of the result list.
 * Reference crop (2x pixels) x=1000 y=570 w=576 h=44 of the full-screen capture: the row
 * stands 75 pt under the window's top and begins at its left edge. The selection is an opaque
 * fill, so this is the one part of the Aqua capture's window that does not show the desktop
 * picture through the material. The window is over the demo's flat mid grey, which the row
 * covers.
 */
export default function VisualSelection() {
  return (
    <div
      className="mac-spotlight-app-example-neutral"
      style={{ position: "relative", overflow: "hidden", width: 288, height: 22 }}
    >
      <CatalinaSpotlight defaultQuery="OS X" style={{ position: "absolute", top: -75, left: 0 }} />
    </div>
  );
}
