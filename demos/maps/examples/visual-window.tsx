import { Maps } from "../maps";

/**
 * Visual comparison target: the Maps window of the Aqua capture, with Apple Park's place
 * card open (the comparison clicks the pin). The card starts 15 pt above the window, so the
 * compared box, `[data-crop="window"]`, is the 1000 x 690 pt frame and the 17 pt above it:
 * reference crop (2x pixels) x=112 y=60 w=2000 h=1414, over the capture's transparent margin
 * (matte white). The box stands 24 pt inside the example, so that the card is not pushed
 * down by the edge of the page.
 */
export default function VisualWindow() {
  return (
    <div style={{ padding: 24, background: "#ffffff" }}>
      <div
        data-crop="window"
        style={{
          position: "relative",
          overflow: "hidden",
          width: 1000,
          height: 707,
          background: "#ffffff",
        }}
      >
        <Maps style={{ position: "absolute", top: 17, left: 0 }} />
      </div>
    </div>
  );
}
