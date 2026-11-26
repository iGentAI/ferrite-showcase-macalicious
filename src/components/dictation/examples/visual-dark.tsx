import { Dictation } from "macalicious/dictation";

/**
 * Visual comparison target: the panel in the Dark Aqua capture, with the level it shows
 * there, and 12 pt of the desktop around it. Reference crop (2x pixels) x=5 y=93 w=220
 * h=240 of 10-15-Catalina-Dark-Dictation.png, 110 x 120 pt; the crop ends just before the
 * TextEdit window. Its origin is odd because the panel sits on odd pixels: so the panel is on
 * whole points here and the 1x comparison is not half a point off.
 *
 * The desktop picture cannot be reproduced: the backdrop is a gradient through the sky as
 * measured clear of the panel (#27426c above it, #2e476b beside it, #3d587d below). The
 * element at the right edge stands for the TextEdit window, whose shadow falls on the gap.
 */
export default function VisualDark() {
  return (
    <div
      style={{
        position: "relative",
        boxSizing: "border-box",
        width: 110,
        height: 120,
        padding: 12,
        overflow: "hidden",
        background: "linear-gradient(#27426c, #2e476b 50%, #3d587d)",
      }}
    >
      <div
        style={{
          position: "absolute",
          left: 111,
          top: -46,
          width: 300,
          height: 468,
          boxShadow: "var(--mac-shadow-window)",
        }}
      />
      <Dictation level={0.3} />
    </div>
  );
}
