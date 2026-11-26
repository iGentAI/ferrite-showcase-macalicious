import { ColorPanel } from "macalicious/color-panel";

/**
 * Fixture for the pixel checks in `color-panel.visual.json`: no screenshot shows the Colors
 * panel, so the checks hold it to the values its spec infers and to the colour it is given.
 *
 * A 268 x 440 pt box, white in Aqua and black in Dark Aqua. The panel is 228 pt wide at 20, 20
 * and starts on the colour wheel with Tangerine (#ff9300), with the opacity slider shown. Its
 * title bar and toolbar end at y 70; the picker is 204 pt wide from 32, 82.
 */
export default function VisualPanel() {
  return (
    <div
      style={{
        position: "relative",
        width: 268,
        height: 440,
        overflow: "hidden",
        background: "light-dark(#ffffff, #000000)",
      }}
    >
      <ColorPanel
        defaultValue="#ff9300"
        showsAlpha
        style={{ position: "absolute", left: 20, top: 20 }}
      />
    </div>
  );
}
