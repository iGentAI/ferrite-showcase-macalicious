import { Slider } from "macalicious/slider";

/**
 * Visual comparison target: the Balance slider of the Sound pane's Output tab, a regular
 * slider with five tick marks below and the directional thumb.
 *
 * Reference crop (2x pixels) x=628 y=936 w=384 h=56, i.e. 192 x 28 pt. The track runs from
 * x=636 to 1003 (184 pt) at y 954 to 959; the thumb's fill starts at y=946, 5 pt below the
 * crop's top, and is centred on x=840, 94.5 pt along the 169 pt its centre can travel.
 */
export default function VisualSound() {
  return (
    <div
      style={{
        boxSizing: "border-box",
        width: 192,
        height: 28,
        padding: "5px 4px 0",
        background: "light-dark(#ececec, #2f3031)",
      }}
    >
      <Slider aria-label="Balance" tickMarks={5} max={338} defaultValue={189} />
    </div>
  );
}
