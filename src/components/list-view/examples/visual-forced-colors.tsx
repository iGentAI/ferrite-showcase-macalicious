import { ListView, ListViewRowDetail, ListViewRowTitle } from "macalicious/list-view";
import type { CSSProperties } from "react";

const blocks = "\u2588\u2588\u2588\u2588\u2588\u2588";
const renderRow = () => (
  <>
    <ListViewRowTitle>{blocks}</ListViewRowTitle>
    <ListViewRowDetail lead={blocks}>{blocks}</ListViewRowDetail>
  </>
);

/**
 * Visual check target for forced colours: a 200 x 112 pt list of two 56 pt rows with a title
 * and a detail line, whose text is runs of full blocks, so that a pixel of it can be read
 * whatever the font. The colours of text on an emphasised selection are given a marker
 * value (red): in forced colours a selected row must not show it, because every line of the
 * row is the system's highlight text.
 */
export default function VisualForcedColors() {
  return (
    <ListView
      aria-label="Forced colours"
      count={2}
      rowHeight={56}
      defaultValue={[1]}
      renderRow={renderRow}
      style={
        {
          width: 200,
          height: 112,
          "--mac-color-selected-content-text": "#ff0000",
          "--mac-list-view-detail-emphasized": "#ff0000",
        } as CSSProperties
      }
    />
  );
}
