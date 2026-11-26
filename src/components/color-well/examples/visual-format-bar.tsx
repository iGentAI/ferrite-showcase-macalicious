import { ColorWell } from "macalicious/color-well";

/**
 * Visual comparison target: the text colour well of TextEdit's format bar in Aqua, where the
 * text colour is black. (`visual-format-bar-white` is the same well in Dark Aqua, where
 * TextEdit's text colour is white.)
 *
 * Reference crop (2x pixels) x=643 y=124 w=58 h=44, that is 29 x 22 pt. The bezel's outline
 * runs x 651 to 694 and y 130 to 161, so the well starts 4 pt from the crop's left edge and
 * 3 pt from its top. (The crop starts on an odd pixel so that the well's edges fall on whole
 * points, as they must for the 1x comparison.) The format bar behind it is a vertical
 * gradient.
 */
export default function VisualFormatBar() {
  return (
    <div
      style={{
        boxSizing: "border-box",
        width: 29,
        height: 22,
        padding: "3px 0 0 4px",
        background: "linear-gradient(light-dark(#d9d9d9, #3c4043), light-dark(#cdcdcd, #37393c))",
      }}
    >
      <ColorWell
        variant="toolbar"
        aria-label="Text colour"
        defaultValue="#000000"
        style={{ display: "block" }}
      />
    </div>
  );
}
