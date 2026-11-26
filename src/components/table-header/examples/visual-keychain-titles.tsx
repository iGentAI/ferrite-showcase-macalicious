import { TableHeader, type TableHeaderColumn } from "macalicious/table-header";
import type { CSSProperties } from "react";

const columns: TableHeaderColumn[] = [
  { id: "name", title: "Name", width: 221, sortable: true },
  { id: "kind", title: "Kind", width: 123, sortable: true },
  { id: "modified", title: "Date Modified", width: 151, sortable: true },
  { id: "keychain", title: "Keychain", sortable: true },
];

/* The header's hook: Keychain Access's titles start 3.5 pt from the column's edge. */
const titles = {
  "--mac-table-header-title-inset": "3.5px 2px",
} as CSSProperties;

/**
 * Visual comparison target: the start of Keychain Access's item table header with its titles
 * where Keychain Access has them, placed by the inset hook, and its sortable headings drawn
 * from a list of columns. The crop is that of `visual-keychain` (2x pixels: x=462 y=356 w=694 h=56, i.e.
 * 347 x 28 pt): 3 pt of the pane above, then the 25 pt header with the 221 pt "Name" column
 * (ascending indicator), the 123 pt "Kind" column and the first 3 pt of "Date Modified".
 */
export default function VisualKeychainTitles() {
  return (
    <div
      style={{
        boxSizing: "border-box",
        overflow: "hidden",
        width: 347,
        height: 28,
        paddingTop: 3,
        background: "var(--mac-color-control-background-tinted)",
      }}
    >
      {/* biome-ignore lint/a11y/useSemanticElements: a header alone needs a table to be a row of; table-view provides the grid */}
      <div role="table" aria-label="Keychain items" style={{ width: 702 }}>
        <TableHeader
          topBorder
          columns={columns}
          sort={{ column: "name", direction: "ascending" }}
          style={titles}
        />
      </div>
    </div>
  );
}
