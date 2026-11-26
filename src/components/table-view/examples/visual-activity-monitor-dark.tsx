import { TableView, type TableViewColumn } from "macalicious/table-view";

const rows = [
  ["Activity Monitor", "19.3", "1.90", "9"],
  ["Screen Shot", "0.8", "0.17", "11"],
  ["iconservicesagent", "0.6", "3.14", "5"],
  ["Control Strip", "0.3", "2.06", "6"],
  ["mdworker_shared", "0.2", "0.09", "3"],
  ["cfprefsd", "0.1", "2.05", "3"],
  ["Finder", "0.1", "21.81", "7"],
  ["loginwindow", "0.1", "1.49", "4"],
  ["mdworker_shared", "0.1", "0.10", "3"],
];

const columns: TableViewColumn[] = [
  { id: "0", title: "Process Name", width: 242, headerAlign: "center" },
  { id: "1", title: "% CPU", width: 78, align: "right", headerAlign: "center", sortable: true },
  { id: "2", title: "CPU Time", width: 73, align: "right", headerAlign: "center" },
  { id: "3", title: "Threads", width: 63, align: "right", headerAlign: "center" },
  { id: "4", title: "Idle Wake Ups" },
];

/**
 * Visual comparison target: the start of Activity Monitor's table in Dark Aqua, where the
 * seventh row is selected while the table has the keyboard focus. Reference crop (2x pixels)
 * x=114 y=188 w=900 h=372, i.e. 450 x 186 pt: the header and nine 18 pt rows. The crop starts
 * 1 pt inside the table, after the window's edge highlight, so the table is shifted left by
 * 1 pt. Otherwise as `visual-activity-monitor`.
 */
export default function VisualActivityMonitorDark() {
  return (
    <div style={{ position: "relative", overflow: "hidden", width: 450, height: 186 }}>
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
        value={[6]}
        sort={{ column: "1", direction: "descending" }}
        style={{ position: "absolute", left: -1, width: 839, height: 186 }}
      />
    </div>
  );
}
