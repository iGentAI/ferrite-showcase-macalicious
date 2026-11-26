import { PushButton } from "macalicious/push-button";
import { TableView, type TableViewColumn } from "macalicious/table-view";
import { useEffect, useRef, useState } from "react";

const ROWS = 200;

const columns: TableViewColumn[] = [
  { id: "name", title: "Message" },
  { id: "row", title: "Row", width: 50, align: "right" },
];

/**
 * `viewportRef` gives the element that scrolls. The buttons scroll it to its end and back,
 * and a listener on it reports the position: scroll the table to see it change.
 */
export default function ScrollToEnd() {
  const viewport = useRef<HTMLDivElement>(null);
  const [top, setTop] = useState(0);
  useEffect(() => {
    const view = viewport.current;
    if (!view) return;
    const read = () => setTop(Math.round(view.scrollTop));
    view.addEventListener("scroll", read, { passive: true });
    return () => view.removeEventListener("scroll", read);
  }, []);
  const scrollTo = (end: boolean) => {
    const view = viewport.current;
    if (view) view.scrollTop = end ? view.scrollHeight : 0;
  };
  return (
    <div style={{ width: 240, font: "var(--mac-font-control-small)" }}>
      <TableView
        aria-label="Messages"
        viewportRef={viewport}
        columns={columns}
        rowCount={ROWS}
        getRowLabel={(row) => `Message ${row + 1}`}
        renderCell={(row, column) => (column.id === "name" ? `Message ${row + 1}` : row + 1)}
        rowHeight={18}
        size="mini"
        alternatingRows
        defaultValue={[ROWS - 1]}
        style={{ width: 240, height: 132 }}
      />
      <div style={{ display: "flex", gap: 12, alignItems: "center", marginTop: 8 }}>
        <PushButton size="small" onClick={() => scrollTo(true)}>
          Scroll to End
        </PushButton>
        <PushButton size="small" onClick={() => scrollTo(false)}>
          Scroll to Top
        </PushButton>
        <span role="status" style={{ color: "var(--mac-color-label)" }}>
          {top} pt
        </span>
      </div>
    </div>
  );
}
