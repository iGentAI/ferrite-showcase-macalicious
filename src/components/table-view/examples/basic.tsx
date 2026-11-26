import { TableView, type TableViewColumn, type TableViewSort } from "macalicious/table-view";
import { useMemo, useState } from "react";

const processes = [
  { name: "Activity Monitor", cpu: 28.3, threads: 20 },
  { name: "iconservicesagent", cpu: 0.8, threads: 6 },
  { name: "sharingd", cpu: 0.2, threads: 4 },
  { name: "cfprefsd", cpu: 0.1, threads: 3 },
  { name: "UserEventAgent", cpu: 0.1, threads: 3 },
  { name: "Finder", cpu: 0.1, threads: 7 },
];

const columns: TableViewColumn[] = [
  { id: "name", title: "Process Name", sortable: true },
  { id: "cpu", title: "% CPU", width: 78, align: "right", sortable: true },
  { id: "threads", title: "Threads", width: 73, align: "right", sortable: true },
];

/** Click a row, then use the arrow keys. Click a heading to sort by it. */
export default function Basic() {
  const [sort, setSort] = useState<TableViewSort>({ column: "cpu", direction: "descending" });
  const rows = useMemo(() => {
    const key = sort.column as keyof (typeof processes)[number];
    const sign = sort.direction === "ascending" ? 1 : -1;
    return [...processes].sort((a, b) => (a[key] < b[key] ? -sign : a[key] > b[key] ? sign : 0));
  }, [sort]);
  return (
    <TableView
      aria-label="Processes"
      columns={columns}
      rowCount={rows.length}
      getRowId={(row) => rows[row]?.name ?? row}
      getRowLabel={(row) => rows[row]?.name ?? ""}
      renderCell={(row, column) => rows[row]?.[column.id as keyof (typeof processes)[number]]}
      rowHeight={18}
      size="small"
      alternatingRows
      defaultValue={["Activity Monitor"]}
      sort={sort}
      onSortChange={setSort}
      style={{ width: 360, height: 150 }}
    />
  );
}
