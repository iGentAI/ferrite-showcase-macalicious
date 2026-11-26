import { TableHeader, TableHeaderCell } from "macalicious/table-header";
import { useState } from "react";

const columns = ["Name", "Kind", "Date Modified"];

/** Click a heading to sort by it; click it again to reverse the order. */
export default function Basic() {
  const [sort, setSort] = useState({ column: "Name", ascending: true });
  return (
    // biome-ignore lint/a11y/useSemanticElements: a header alone needs a table to be a row of; table-view provides the grid
    <div role="table" aria-label="Keychain items" style={{ width: 420 }}>
      <TableHeader topBorder>
        {columns.map((column) => (
          <TableHeaderCell
            key={column}
            sortDirection={
              sort.column === column ? (sort.ascending ? "ascending" : "descending") : undefined
            }
            onSort={() =>
              setSort({ column, ascending: sort.column === column ? !sort.ascending : true })
            }
          >
            {column}
          </TableHeaderCell>
        ))}
      </TableHeader>
    </div>
  );
}
