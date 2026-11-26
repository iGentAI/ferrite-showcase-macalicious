import { RoundRectButton } from "macalicious/round-rect-button";
import { SystemImage } from "macalicious/system-image";

/**
 * Visual comparison target: the add button under Collections in Books' sidebar, a square
 * round-rect button around the add image, in an inactive window. The comparison sets the window
 * state.
 *
 * Reference crop (2x pixels) x=160 y=566 w=48 h=48, that is 24 x 24 pt of the sidebar (#f6f6f6,
 * Dark Aqua #2c2e30). The button is 18 x 18 pt, 3 pt from the crop's left and top (x 166..201,
 * y 572..607); its plus is 10 pt long and 1 pt thick (x 174..193, rows y 589..590), so the
 * library's 11 pt add image is drawn at 10 pt here.
 */
export default function VisualBooksAdd() {
  return (
    <div
      style={{
        boxSizing: "border-box",
        width: 24,
        height: 24,
        padding: "3px 0 0 3px",
        lineHeight: 0,
        background: "light-dark(#f6f6f6, #2c2e30)",
      }}
    >
      <RoundRectButton aria-label="Add Collection" style={{ width: 18, padding: 0 }}>
        <SystemImage name="add" width={10} height={10} />
      </RoundRectButton>
    </div>
  );
}
