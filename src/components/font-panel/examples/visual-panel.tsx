import { FontPanel } from "macalicious/font-panel";
import { FONT_FAMILIES } from "macalicious/lib/rich-text";

/**
 * Fixture for the pixel checks in `font-panel.visual.json`: no screenshot shows the Fonts
 * panel, so the checks hold it to the measured colours of the window and the lists it is built
 * from, and to the format it is given.
 *
 * A 484 x 300 pt box, white in Aqua and black in Dark Aqua. The panel is 444 pt wide at 20, 20
 * and shows Georgia Bold 14 in red, underlined.
 */
export default function VisualPanel() {
  return (
    <div
      style={{
        position: "relative",
        width: 484,
        height: 300,
        overflow: "hidden",
        background: "light-dark(#ffffff, #000000)",
      }}
    >
      <FontPanel
        families={FONT_FAMILIES}
        value={{
          family: "Georgia",
          bold: true,
          italic: false,
          size: 14,
          underline: true,
          color: "#ff0000",
        }}
        style={{ position: "absolute", left: 20, top: 20 }}
      />
    </div>
  );
}
