import { Chess } from "../chess";

/**
 * Visual comparison target: the Chess window of the captures, 971 x 702 pt (reference crop,
 * 2x pixels: x=112 y=76 w=1942 h=1404), over the capture's transparent margin (matte white),
 * before the first move. The two captures show the same window, so this one example is
 * compared with both, in its Aqua and its Dark Aqua appearance.
 *
 * Under the title bar the captures show the application's three-dimensional scene and the
 * demo shows an abstract placeholder, so that region is in no comparison. The element marked
 * `data-crop` draws nothing: it is the region that is compared, the 22 pt title bar.
 */
export default function VisualWindow() {
  return (
    <div
      style={{
        position: "relative",
        overflow: "hidden",
        width: 971,
        height: 702,
        background: "var(--mac-chess-visual-matte)",
      }}
    >
      <Chess white="Player" black="Computer" style={{ position: "absolute", inset: 0 }} />
      <div
        data-crop="title-bar"
        style={{
          position: "absolute",
          left: 0,
          top: 0,
          width: 971,
          height: 22,
          pointerEvents: "none",
        }}
      />
    </div>
  );
}
