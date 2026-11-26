import { TableView, type TableViewColumn } from "macalicious/table-view";
import { type CSSProperties, useLayoutEffect, useRef } from "react";

const rows = [
  ["10:38:48.701954-0500", "mds", "directQueryFetchResultsReply 208975 1795162112 35 at qos 0x15"],
  ["10:38:48.790122-0500", "hidd", "[HID] [MT] dispatchEvent Dispatching event with 3 children"],
  ["10:38:48.845458-0500", "distnoted", "register name: DictationIMNotification object: (null)"],
  ["10:38:48.942671-0500", "ReportCrash", "Memory Resource Exception log limit reached"],
  ["10:38:48.942815-0500", "ReportCrash", "SDRDiagnosticReporter is disabled"],
  ["10:38:48.942946-0500", "ReportCrash", "Memory Resource Exception log limit reached"],
  ["10:38:48.967999-0500", "hidd", "[HID] [MT] dispatchEvent Dispatching event with 4 children"],
  ["10:38:49.014260-0500", "mds", "directQueryFetchResultsReply 208975 1795162112 35 at qos 0x15"],
  ["10:38:49.120377-0500", "hidd", "[HID] [MT] dispatchEvent Dispatching event with 3 children"],
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
 * Visual comparison target: the start of Console's message table, Dark Aqua, whose capture
 * lists other messages than the light one. Reference crop (2x pixels) x=474 y=260 w=700
 * h=132, i.e. 350 x 66 pt: the translucent 24 pt header and 42 pt of the 21 pt rows. The
 * table is scrolled by 57 pt through `viewportRef`, as the capture is: a striped row and then
 * the row of 10:38:48.845458 are under the header, whose text shows through it.
 */
export default function VisualConsoleDark() {
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
