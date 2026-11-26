import { TableView, type TableViewColumn } from "macalicious/table-view";
import type { CSSProperties } from "react";

const columns: TableViewColumn[] = [{ id: "a" }];

/**
 * Visual check target for forced colours: a 120 x 60 pt table of three 20 pt rows whose text
 * is a run of full blocks, so that a pixel of it can be read whatever the font. The colour
 * of text on an emphasised selection is given a marker value (red): in forced colours a
 * selected row must not show it, because the row's text is the system's highlight text.
 */
export default function VisualForcedColors() {
  return (
    <div style={{ "--mac-color-selected-content-text": "#ff0000" } as CSSProperties}>
      <TableView
        aria-label="Forced colours"
        columns={columns}
        rowCount={3}
        renderCell={() => "\u2588\u2588\u2588\u2588\u2588\u2588"}
        rowHeight={20}
        header="none"
        defaultValue={[1]}
        style={{ width: 120, height: 60 }}
      />
    </div>
  );
}
