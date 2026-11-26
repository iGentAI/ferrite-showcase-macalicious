import { TableHeader, TableHeaderCell } from "macalicious/table-header";
import type { CSSProperties } from "react";

const noop = () => {};

/* The header's hook: Console's titles start 2 pt from the column's edge. */
const titles = {
  "--mac-table-header-title-inset": "2px 6px",
} as CSSProperties;

/**
 * Visual comparison target: the start of Console's header as Console draws it, the
 * translucent variant with its sortable titles placed by the inset hook. The crop is that of
 * `visual-console` (2x pixels: x=474 y=258 w=700 h=50, i.e. 350 x 25 pt): one point of the
 * content background, then the 53 pt "Type", 173 pt "Time" and 63 pt "Process" columns and
 * the start of "Message". No row is under the header here, so its fill is the content
 * background seen through it.
 */
export default function VisualConsoleTitles() {
  return (
    <div
      style={{
        boxSizing: "border-box",
        overflow: "hidden",
        width: 350,
        height: 25,
        paddingTop: 1,
        background: "light-dark(#ffffff, #1e1e1e)",
      }}
    >
      {/* biome-ignore lint/a11y/useSemanticElements: a header alone needs a table to be a row of; table-view provides the grid */}
      <div role="table" aria-label="Log messages" style={{ width: 819 }}>
        <TableHeader variant="translucent" style={titles}>
          <TableHeaderCell width={53} onSort={noop}>
            Type
          </TableHeaderCell>
          <TableHeaderCell width={173} onSort={noop}>
            Time
          </TableHeaderCell>
          <TableHeaderCell width={63} onSort={noop}>
            Process
          </TableHeaderCell>
          <TableHeaderCell onSort={noop}>Message</TableHeaderCell>
        </TableHeader>
      </div>
    </div>
  );
}
