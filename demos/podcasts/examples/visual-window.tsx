import { Podcasts } from "../podcasts";

/**
 * Visual comparison target: the whole of 10-15-Catalina-Light-Podcasts.png, 1249 x 876 pt,
 * with the window at (56, 38) over a white matte. Nothing is loaded, as in the capture: the
 * display is idle and the skip buttons are disabled.
 */
export default function VisualWindow() {
  return (
    <div
      style={{
        position: "relative",
        overflow: "hidden",
        width: 1249,
        height: 876,
        background: "var(--mac-podcasts-visual-matte)",
      }}
    >
      <Podcasts material="opaque" style={{ position: "absolute", left: 56, top: 38 }} />
    </div>
  );
}
