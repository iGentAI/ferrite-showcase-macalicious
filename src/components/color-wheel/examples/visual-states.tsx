import { ColorSpectrum, ColorWheel } from "macalicious/color-wheel";

/**
 * Fixture for the pixel checks in `color-wheel.visual.json`: no screenshot shows the Colors
 * panel, so the checks hold the two areas to the HSB colour model they draw.
 *
 * A 460 x 180 pt box, white in Aqua and black in Dark Aqua. The wheel is 120 pt wide at 20, 20:
 * its disc is centred on 80, 80 with a radius of 60 pt, and its brightness slider is under it.
 * The spectrum is 240 x 120 pt at 200, 20. Both hold white, so the wheel's marker is at its
 * centre and the spectrum's at its top left corner, away from the points that are checked.
 */
export default function VisualStates() {
  return (
    <div
      style={{
        position: "relative",
        width: 460,
        height: 180,
        overflow: "hidden",
        background: "light-dark(#ffffff, #000000)",
      }}
    >
      <ColorWheel style={{ position: "absolute", left: 20, top: 20, width: 120 }} />
      <ColorSpectrum style={{ position: "absolute", left: 200, top: 20, width: 240 }} />
    </div>
  );
}
