import { TableHeader, TableHeaderCell } from "macalicious/table-header";

const noop = () => {};

/**
 * Visual check target for the states no screenshot shows: a 240 x 24 pt header of three
 * 80 pt columns with short titles at their leading edge. The first sorts (a button fills it),
 * the second can only be resized, the third is plain. The comparisons press and focus them.
 */
export default function VisualStates() {
  return (
    // biome-ignore lint/a11y/useSemanticElements: a header alone needs a table to be a row of; table-view provides the grid
    <div role="table" aria-label="States" style={{ width: 240 }}>
      <TableHeader>
        <TableHeaderCell width={80} onSort={noop}>
          One
        </TableHeaderCell>
        <TableHeaderCell width={80} onResize={noop}>
          Two
        </TableHeaderCell>
        <TableHeaderCell>Three</TableHeaderCell>
      </TableHeader>
    </div>
  );
}
