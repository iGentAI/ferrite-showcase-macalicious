import { Switch } from "macalicious/switch";

/* The panel behind the switch is a vibrant material, not a flat colour: these are its pixels
   along the top row (y=178) and the bottom row (y=237) of the crop, every 5 pt from
   x=3234, in Aqua and Dark Aqua. The example interpolates between the two rows. */
const TOP = [
  ["#e8f2f3", "#35393c"],
  ["#e8f2f4", "#36383b"],
  ["#e7f2f4", "#34383b"],
  ["#e7f2f7", "#32363c"],
  ["#e7f2f8", "#31363a"],
  ["#e6f2f9", "#2e343b"],
  ["#e5f2fb", "#2b323b"],
  ["#e3f3fc", "#29303b"],
  ["#e2f4fe", "#272e3b"],
  ["#e2f4ff", "#252d3b"],
];
const BOTTOM = [
  ["#e4f3fa", "#2d333c"],
  ["#e4f4fa", "#2d333c"],
  ["#e4f4fb", "#2d323c"],
  ["#e4f4fc", "#2b323c"],
  ["#e3f4fd", "#28323c"],
  ["#e3f4fe", "#28303c"],
  ["#e2f4ff", "#262e3b"],
  ["#e2f4ff", "#232e3b"],
  ["#e1f5ff", "#212c3c"],
  ["#e0f5ff", "#202b3c"],
];
const row = (stops: string[][]) =>
  `linear-gradient(to right, ${stops
    .map(([light, dark], i) => `light-dark(${light}, ${dark}) ${5 * i + 0.25}px`)
    .join(", ")})`;

/**
 * Visual comparison target: the Do Not Disturb switch of Notification Center's Today view,
 * off, the only switch in the reference set.
 *
 * Reference crop (2x pixels) x=3234 y=178 w=92 h=60, i.e. 46 x 30 pt. The track's edges are at
 * x 3242 to 3317 and y 187 to 228, so the switch starts 4 pt from the crop's left edge and
 * 4.5 pt from its top.
 */
export default function VisualNotificationCenter() {
  return (
    <div
      style={{
        position: "relative",
        boxSizing: "border-box",
        width: 46,
        height: 30,
        padding: "4.5px 0 0 4px",
        background: row(TOP),
      }}
    >
      <div
        style={{
          position: "absolute",
          inset: 0,
          background: row(BOTTOM),
          maskImage: "linear-gradient(to bottom, transparent, black)",
        }}
      />
      <Switch aria-label="Do Not Disturb" style={{ display: "block" }} />
    </div>
  );
}
