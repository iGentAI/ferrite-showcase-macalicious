import { TableView, type TableViewColumn } from "macalicious/table-view";
import { type CSSProperties, useLayoutEffect, useRef } from "react";

const rows = [
  ["15:07:45.201173-0500", "kernel", "[IGFB][INFO   ] [Flip_Transaction] CCS Param update"],
  ["15:07:45.334020-0500", "tccd", "PID[259] is checking access for target PID[1835]"],
  ["15:07:45.395745-0500", "hidd", "[HID] [MT] dispatchEvent Dispatching event with 3 children"],
  ["15:07:45.459156-0500", "hidd", "[HID] [MT] dispatchEvent Dispatching event with 4 children"],
  ["15:07:45.585396-0500", "tccd", "PID[259] is checking access for target PID[1835]"],
  ["15:07:45.585726-0500", "tccd", "Granting PID[1835] access to kTCCServiceScreenCapture"],
  ["15:07:45.609615-0500", "kernel", "[IGFB][INFO   ] [Flip_Transaction] CCS Param update"],
  ["15:07:45.684375-0500", "hidd", "[HID] [MT] dispatchEvent Dispatching event with 3 children"],
  ["15:07:45.701288-0500", "hidd", "[HID] [MT] dispatchEvent Dispatching event with 4 children"],
];

const columns: TableViewColumn[] = [
  { id: "type", title: "Type", width: 53, sortable: true },
  { id: "0", title: "Time", width: 173, sortable: true },
  { id: "1", title: "Process", width: 63, sortable: true },
  { id: "2", title: "Message", minWidth: 200, sortable: true },
];

/* Console's cells: 11 pt fixed pitch, 7 pt from the column's edge (the cell's own 3 pt and
   these 4), the baseline 10 pt under the row's top. */
const cell: CSSProperties = {
  display: "block",
  overflow: "hidden",
  padding: "0.5px 0 0 4px",
  font: "var(--mac-font-weight-regular) 11px / 14px var(--mac-font-family-monospace)",
  letterSpacing: "normal",
  whiteSpace: "pre",
  textOverflow: "ellipsis",
};

/* The header's hook: Console's titles start 2 pt from the column's edge. */
const table = {
  width: 819,
  height: 135,
  "--mac-table-header-title-inset": "2px 6px",
} as CSSProperties;

/**
 * Visual comparison target: the start of Console's message table, Aqua, with its translucent
 * header. Reference crop (2x pixels) x=474 y=260 w=700 h=132, i.e. 350 x 66 pt: the 24 pt
 * header and 42 pt of the 21 pt rows. The table is scrolled by 57 pt through `viewportRef`,
 * as the capture is: a striped row and then the row of 15:07:45.395745 are under the header,
 * whose text shows through it, and the first stripe starts 6 pt under the header.
 */
export default function VisualConsole() {
  const viewport = useRef<HTMLDivElement>(null);
  useLayoutEffect(() => {
    if (viewport.current) viewport.current.scrollTop = 57;
  }, []);
  return (
    <div style={{ overflow: "hidden", width: 350, height: 66 }}>
      <TableView
        aria-label="Messages"
        viewportRef={viewport}
        columns={columns}
        rowCount={rows.length}
        renderCell={(row, column) =>
          column.id === "type" ? null : <span style={cell}>{rows[row]?.[Number(column.id)]}</span>
        }
        rowHeight={21}
        size="mini"
        header="translucent"
        alternatingRows
        selectionMode="none"
        style={table}
      />
    </div>
  );
}
