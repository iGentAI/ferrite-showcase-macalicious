import { Dictation } from "macalicious/dictation";

/**
 * Visual comparison target: the panel in the Aqua capture, silent, with 12 pt of the desktop
 * around it. Reference crop (2x pixels) x=29 y=99 w=220 h=240 of
 * 10-15-Catalina-Light-Dictation.png, 110 x 120 pt; the crop ends just before the TextEdit
 * window. Its origin is odd because the panel sits on odd pixels: so the panel is on whole
 * points here and the 1x comparison is not half a point off.
 *
 * The desktop picture cannot be reproduced: the backdrop is a gradient through the sky as
 * measured clear of the panel (#87bdee above it, #8dbfe9 beside it, #a1cef2 below). The
 * element at the right edge stands for the TextEdit window, whose shadow falls on the gap.
 */
export default function VisualLight() {
  return (
    <div
      style={{
        position: "relative",
        boxSizing: "border-box",
        width: 110,
        height: 120,
        padding: 12,
        overflow: "hidden",
        background: "linear-gradient(#87bdee, #8dbfe9 50%, #a1cef2)",
      }}
    >
      <div
        style={{
          position: "absolute",
          left: 111,
          top: -48,
          width: 300,
          height: 468,
          boxShadow: "var(--mac-shadow-window)",
        }}
      />
      <Dictation />
    </div>
  );
}
