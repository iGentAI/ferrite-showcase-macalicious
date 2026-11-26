import { TableView, TableViewCellText, type TableViewColumn } from "macalicious/table-view";
import { useState } from "react";

const files = [
  "Quarterly report for the board, final draft.pages",
  "Screen Shot 2019-10-07 at 2.57.31 PM.png",
  "com.apple.account.AppleAccount.cloudkit-token",
  "Notes.txt",
];

/**
 * The same names cut in their middle and at their end. Drag the separator after the first
 * heading: a name cut in its middle keeps its ending, where a file's extension is.
 */
export default function LineBreakMode() {
  const [width, setWidth] = useState(190);
  const columns: TableViewColumn[] = [
    { id: "middle", title: "Truncating Middle", width, minWidth: 90, maxWidth: 320 },
    { id: "tail", title: "Truncating Tail" },
  ];
  return (
    <TableView
      aria-label="File names"
      columns={columns}
      rowCount={files.length}
      getRowLabel={(row) => files[row] ?? ""}
      renderCell={(row, column) =>
        column.id === "middle" ? (
          <TableViewCellText lineBreakMode="truncating-middle">
            {files[row] ?? ""}
          </TableViewCellText>
        ) : (
          files[row]
        )
      }
      rowHeight={18}
      size="mini"
      alternatingRows
      onColumnResize={(_, next) => setWidth(next)}
      style={{ width: 420, height: 100 }}
    />
  );
}
