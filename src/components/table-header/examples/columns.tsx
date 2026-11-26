import {
  TableHeader,
  type TableHeaderColumn,
  type TableHeaderSort,
} from "macalicious/table-header";
import { useState } from "react";

/**
 * A header that draws its headings from a list of columns, as a table view's header does:
 * click a heading to sort by it, drag a separator to resize its column.
 */
export default function Columns() {
  const [sort, setSort] = useState<TableHeaderSort>({ column: "name", direction: "ascending" });
  const [widths, setWidths] = useState<Record<string, number>>({ name: 180, kind: 120 });
  const columns: TableHeaderColumn[] = [
    { id: "name", title: "Name", width: widths.name, minWidth: 80, sortable: true },
    { id: "kind", title: "Kind", width: widths.kind, minWidth: 60, sortable: true },
    { id: "size", title: "Size", align: "right", sortable: true },
  ];
  return (
    // biome-ignore lint/a11y/useSemanticElements: a header alone needs a table to be a row of; table-view provides the grid
    <div role="table" aria-label="Files" style={{ width: 420 }}>
      <TableHeader
        topBorder
        columns={columns}
        sort={sort}
        onSortChange={setSort}
        onColumnResize={(column, width) => setWidths((old) => ({ ...old, [column]: width }))}
      />
    </div>
  );
}
