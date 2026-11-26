import { AboutThisMac } from "../about-this-mac";

/**
 * Visual comparison target: the About This Mac window of the light capture, cropped at its
 * frame from the full-screen capture: x=1094 y=386 w=1172 h=706 (2x pixels), the 586 x 353 pt
 * frame. The capture shows the desktop picture around the frame and behind its rounded
 * corners, and no shadow inside the crop: the box paints a neutral matte, clips the shadow,
 * and the comparisons mask the four corners.
 */
export default function VisualWindow() {
  return (
    <div
      style={{
        position: "relative",
        overflow: "hidden",
        width: 586,
        height: 353,
        background: "var(--mac-about-this-mac-visual-matte)",
      }}
    >
      <AboutThisMac style={{ position: "absolute", inset: 0 }} />
    </div>
  );
}
