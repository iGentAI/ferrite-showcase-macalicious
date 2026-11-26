import { ColorPalette, CRAYON_COLORS } from "macalicious/color-palette";

/**
 * Fixture for the pixel checks in `color-palette.visual.json`: no screenshot shows the Colors
 * panel, so the checks hold the palette to the colours it is given and to the shared selection
 * tokens.
 *
 * A 460 x 220 pt box, white in Aqua and black in Dark Aqua. The list is 200 pt wide at 20, 20
 * with Blue chosen: 19 pt rows, the swatch from 4 pt inside the frame. The pencils are 200 pt
 * wide at 240, 20 with Maraschino chosen: twelve columns of 16.67 pt, a new row every 34 pt.
 */
export default function VisualStates() {
  return (
    <div
      style={{
        position: "relative",
        width: 460,
        height: 220,
        overflow: "hidden",
        background: "light-dark(#ffffff, #000000)",
      }}
    >
      <ColorPalette
        aria-label="Apple"
        defaultValue="#0000ff"
        style={{ position: "absolute", left: 20, top: 20 }}
      />
      <ColorPalette
        aria-label="Pencils"
        variant="pencils"
        colors={CRAYON_COLORS}
        defaultValue="#ff2600"
        style={{ position: "absolute", left: 240, top: 20 }}
      />
    </div>
  );
}
