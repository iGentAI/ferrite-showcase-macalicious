import { TableView, type TableViewColumn } from "macalicious/table-view";

const rows = [
  ["Activity Monitor", "28.3", "1.67", "20"],
  ["iconservicesagent", "0.8", "2.09", "6"],
  ["sharingd", "0.2", "1.40", "4"],
  ["cfprefsd", "0.1", "1.93", "3"],
  ["UserEventAgent", "0.1", "1.26", "3"],
];

const columns: TableViewColumn[] = [
  { id: "0", title: "Process Name", width: 242, headerAlign: "center" },
  { id: "1", title: "% CPU", width: 78, align: "right", headerAlign: "center", sortable: true },
  { id: "2", title: "CPU Time", width: 73, align: "right", headerAlign: "center" },
  { id: "3", title: "Threads", width: 63, align: "right", headerAlign: "center" },
  { id: "4", title: "Idle Wake Ups" },
];

/**
 * Visual comparison target: the start of Activity Monitor's table in Aqua, with the first row
 * selected while the table has the keyboard focus. Reference crop (2x pixels) x=112 y=188
 * w=900 h=228, i.e. 450 x 114 pt: the header and five 18 pt rows, the 242 pt, 78 pt and 73 pt
 * columns and most of the fourth. Names start 46 pt from the table's edge, after the icon
 * column, whose artwork is not reproduced; the values are right-aligned under centred titles
 * (`headerAlign`).
 * `data-force` shows the emphasised selection without focus.
 */
export default function VisualActivityMonitor() {
  return (
    <div style={{ overflow: "hidden", width: 450, height: 114 }}>
      <TableView
        aria-label="Processes"
        data-force="focus"
        columns={columns}
        rowCount={rows.length}
        renderCell={(row, column) =>
          column.id === "0" ? (
            <div style={{ paddingLeft: 43 }}>{rows[row]?.[0]}</div>
          ) : (
            rows[row]?.[Number(column.id)]
          )
        }
        rowHeight={18}
        size="small"
        alternatingRows
        value={[0]}
        sort={{ column: "1", direction: "descending" }}
        style={{ width: 839, height: 114 }}
      />
    </div>
  );
}
