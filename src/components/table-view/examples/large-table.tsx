import { TableView, type TableViewColumn } from "macalicious/table-view";
import { useState } from "react";

const ROWS = 10000;
const kinds = ["application password", "public key", "private key", "certificate"];

/**
 * Ten thousand rows, multiple selection and resizable columns. Only the rows in view are in
 * the document: scroll, press Page Down or End, Shift-click a range, or press Command-A.
 */
export default function LargeTable() {
  const [widths, setWidths] = useState<Record<string, number>>({ name: 180, kind: 150 });
  const [selected, setSelected] = useState<readonly (string | number)[]>([3]);
  const columns: TableViewColumn[] = [
    { id: "name", title: "Name", width: widths.name, minWidth: 80, maxWidth: 320 },
    { id: "kind", title: "Kind", width: widths.kind, minWidth: 80, maxWidth: 240 },
    { id: "row", title: "Row", align: "right" },
  ];
  return (
    <div style={{ font: "var(--mac-font-control-small)", color: "var(--mac-color-label)" }}>
      <TableView
        aria-label="Ten thousand items"
        columns={columns}
        rowCount={ROWS}
        getRowLabel={(row) => `Item ${row + 1}`}
        renderCell={(row, column) =>
          column.id === "name"
            ? `Item ${row + 1}`
            : column.id === "kind"
              ? kinds[row % kinds.length]
              : row + 1
        }
        rowHeight={18}
        size="mini"
        alternatingRows
        selectionMode="multiple"
        value={selected}
        onValueChange={setSelected}
        onColumnResize={(column, width) => setWidths((old) => ({ ...old, [column]: width }))}
        style={{ width: 460, height: 240 }}
      />
      <p role="status" style={{ margin: "6px 0 0" }}>
        {selected.length} of {ROWS} selected
      </p>
    </div>
  );
}
