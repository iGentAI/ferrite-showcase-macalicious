import { CatalinaSpotlight } from "../spotlight";

/**
 * Visual check target: the Spotlight window in Aqua, searching for "OS X": the definition
 * selected and shown in the preview, 680 x 430 pt.
 *
 * It is not compared with the Aqua capture. That capture is of the whole screen, and its
 * window is translucent over the desktop picture, which is Apple's: every pixel of the panel
 * depends on a picture that is neither shipped nor imitated. The window stands here over a
 * flat mid grey of the demo's own (`--mac-spotlight-app-example-neutral`), and the checks read
 * what the material and the window's parts give over it.
 */
export default function VisualWindow() {
  return (
    <div
      className="mac-spotlight-app-example-neutral"
      style={{ position: "relative", overflow: "hidden", width: 680, height: 430 }}
    >
      <CatalinaSpotlight defaultQuery="OS X" style={{ position: "absolute", top: 0, left: 0 }} />
    </div>
  );
}
