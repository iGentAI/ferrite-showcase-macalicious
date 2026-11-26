import { TableView, type TableViewColumn } from "macalicious/table-view";

const columns: TableViewColumn[] = [{ id: "a", width: 60 }, { id: "b" }];

/**
 * Visual check target for the states no screenshot shows: a 120 x 80 pt table of four 20 pt
 * rows without a header and without text, with multiple selection and the second row
 * selected. The comparisons click, Shift-click and use the keyboard.
 */
export default function VisualStates() {
  return (
    <TableView
      aria-label="States"
      columns={columns}
      rowCount={4}
      renderCell={() => null}
      rowHeight={20}
      header="none"
      alternatingRows
      selectionMode="multiple"
      defaultValue={[1]}
      style={{ width: 120, height: 80 }}
    />
  );
}
