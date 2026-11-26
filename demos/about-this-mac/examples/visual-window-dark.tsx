import { AboutThisMac } from "../about-this-mac";
import { darkCaptureInfo } from "../about-this-mac-data";

/**
 * Visual comparison target: the About This Mac window of the dark capture, which shows the
 * serial number. Reference crop (2x pixels) x=1094 y=386 w=1172 h=706, the 586 x 353 pt
 * frame, over a neutral matte with the shadow clipped; the comparisons mask the four corners,
 * where the capture shows the desktop picture.
 *
 * The dark capture's window background is tinted by the desktop picture (#303032), so the
 * box gives the window the library's tinted value of that colour.
 */
export default function VisualWindowDark() {
  return (
    <div
      style={{
        position: "relative",
        overflow: "hidden",
        width: 586,
        height: 353,
        background: "var(--mac-about-this-mac-visual-matte)",
        ["--mac-color-window-background" as string]: "var(--mac-color-window-background-tinted)",
      }}
    >
      <AboutThisMac info={darkCaptureInfo} style={{ position: "absolute", inset: 0 }} />
    </div>
  );
}
