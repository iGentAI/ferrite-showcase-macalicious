import { Slider } from "macalicious/slider";

const frame = {
  boxSizing: "border-box",
  width: 248,
  height: 26,
  padding: "5px 4px 0",
  background: "light-dark(#e3e3e3, #363637)",
} as const;

/**
 * Visual comparison target: the Brightness slider of the Displays pane, a regular slider
 * without tick marks: round knob, track filled with the accent colour up to the knob.
 *
 * Reference crop (2x pixels) x=848 y=380 w=496 h=52, i.e. 248 x 26 pt. The track runs from
 * x=856 to 1335 (240 pt) at y 402 to 407; the knob's fill is 30 px wide from y=390. Its centre
 * is at x=1233 in the Aqua capture and at x=1224 in the Dark Aqua one, 181 and 176.5 pt along
 * the 225 pt the centre can travel, so each appearance has its own element (`#light`,
 * `#dark`), which the comparison selects.
 */
export default function VisualDisplays() {
  return (
    <div style={{ display: "grid", gap: 8 }}>
      <div id="light" style={frame}>
        <Slider aria-label="Brightness" max={450} defaultValue={362} />
      </div>
      <div id="dark" style={frame}>
        <Slider aria-label="Brightness" max={450} defaultValue={353} />
      </div>
    </div>
  );
}
