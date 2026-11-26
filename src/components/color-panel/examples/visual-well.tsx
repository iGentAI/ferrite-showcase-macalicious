import { ColorPanelWell } from "macalicious/color-panel";
import { useState } from "react";

/**
 * Fixture for the pixel checks of `ColorPanelWell` in `color-panel.visual.json`.
 *
 * A 268 x 420 pt box of the window background. A standard 44 x 23 pt well holding Tangerine
 * (#ff9300) is at 20, 20; the panel it opens is rendered into the box, so that it is part of
 * the capture, and appears 6 pt under the well with their leading edges aligned.
 */
export default function VisualWell() {
  const [box, setBox] = useState<HTMLDivElement | null>(null);
  return (
    <div
      ref={setBox}
      style={{
        position: "relative",
        width: 268,
        height: 420,
        overflow: "hidden",
        background: "light-dark(#ececec, #323232)",
      }}
    >
      <ColorPanelWell
        aria-label="Fill"
        defaultValue="#ff9300"
        container={box}
        style={{ position: "absolute", left: 20, top: 20 }}
      />
    </div>
  );
}
