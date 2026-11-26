import { PushButton } from "macalicious/push-button";

/**
 * Visual comparison target: Done under a Contacts card that is being edited, an emphasised push
 * button.
 *
 * Reference crop (2x pixels) x=1609 y=833 w=138 h=62, that is 69 x 31 pt of the card (#ffffff).
 * The bezel is 59 pt wide and 20 pt high (x 1619..1736, y 843..884 with its shadow), 5 pt from
 * the crop's left and top, so the button's box starts 4.5 pt in and is 60 pt wide: Contacts lays
 * the card out on half points. The title's capitals are 9 pt high: 13 pt text. Contacts fixes
 * the width; the fallback font's semibold is a little wider than San Francisco's, so the
 * example narrows the padding beside the title rather than let it truncate.
 */
export default function VisualContactsDone() {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "flex-start",
        boxSizing: "border-box",
        width: 69,
        height: 31,
        padding: "4.5px 0 0 4.5px",
        background: "light-dark(#ffffff, #1e1f20)",
      }}
    >
      <PushButton variant="emphasized" style={{ width: 60, padding: "0 10px" }}>
        Done
      </PushButton>
    </div>
  );
}
