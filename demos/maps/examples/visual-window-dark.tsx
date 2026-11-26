import { Maps } from "../maps";

/**
 * Visual comparison target: the Maps window of the Dark Aqua capture, which differs from the
 * Aqua one in three things: the search field is empty, no weather is shown, and the place
 * card points 28 pt lower (at the pin's foot, with the ball hidden),
 * so that it lies inside the window. The demo's card points at the ball, so here the map is
 * moved by that much instead. The compared box, `[data-crop="window"]`, is the 1000 x 690 pt
 * frame: reference crop (2x pixels) x=112 y=76 w=2000 h=1380, over the capture's transparent
 * margin (matte white). The comparison clicks the pin to open the card.
 */
export default function VisualWindowDark() {
  return (
    <div style={{ padding: 24, background: "#ffffff" }}>
      <div
        data-crop="window"
        style={{
          position: "relative",
          overflow: "hidden",
          width: 1000,
          height: 690,
          background: "#ffffff",
        }}
      >
        <Maps
          defaultQuery=""
          weather={null}
          defaultCenter={{ x: 999, y: 733.5 }}
          style={{ position: "absolute", top: 0, left: 0 }}
        />
      </div>
    </div>
  );
}
