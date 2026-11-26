import { TableView, type TableViewColumn } from "macalicious/table-view";
import { useLayoutEffect, useRef } from "react";

const columns: TableViewColumn[] = [
  { id: "a", title: "A", width: 60 },
  { id: "b", title: "B" },
];

/**
 * Visual check target for the translucent header: a 120 x 104 pt table of thirty 20 pt rows
 * without text, under two short headings, the second row selected, scrolled by 26 pt through
 * `viewportRef` so that the
 * selected row's first 6 pt are under the header. `data-force` pins the emphasised selection,
 * which the table otherwise shows only while it has the keyboard focus: focusing it would
 * scroll the selected row into view.
 */
export default function VisualTranslucent() {
  const viewport = useRef<HTMLDivElement>(null);
  useLayoutEffect(() => {
    if (viewport.current) viewport.current.scrollTop = 26;
  }, []);
  return (
    <TableView
      aria-label="Translucent header"
      viewportRef={viewport}
      columns={columns}
      rowCount={30}
      renderCell={() => null}
      rowHeight={20}
      header="translucent"
      alternatingRows
      defaultValue={[1]}
      data-force="focus"
      style={{ width: 120, height: 104 }}
    />
  );
}
