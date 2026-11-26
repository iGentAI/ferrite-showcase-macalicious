import { Slider } from "macalicious/slider";

const frame = {
  boxSizing: "border-box",
  width: 211,
  height: 27,
  padding: "4.5px 4.5px 0",
  background: "light-dark(#ececec, #303031)",
} as const;

/**
 * Visual comparison target: the Size and Magnification sliders of the Dock pane, regular
 * sliders with a tick mark at each end. Magnification is at its maximum, which shows where
 * the thumb stops: its fill ends flush with the end of the track.
 *
 * Reference crops (2x pixels) x=636 w=422 h=54 at y=190 (Size) and y=286 (Magnification),
 * i.e. 211 x 27 pt each. The tracks run from x=645 to 1048 (202 pt), 4.5 pt from the crop's
 * left edge; the thumbs' fills start 4.5 pt below its top. Size is centred on x=820, 80 pt
 * along the 187 pt its centre can travel. The comparisons select `#size` and
 * `#magnification`.
 */
export default function VisualDock() {
  return (
    <div style={{ display: "grid", gap: 8 }}>
      <div id="size" style={frame}>
        <Slider aria-label="Size" tickMarks={2} max={374} defaultValue={160} />
      </div>
      <div id="magnification" style={frame}>
        <Slider aria-label="Magnification" tickMarks={2} defaultValue={100} />
      </div>
    </div>
  );
}
