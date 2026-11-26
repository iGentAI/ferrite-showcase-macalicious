import { TableHeader, TableHeaderCell } from "macalicious/table-header";

const noop = () => {};

/**
 * Visual comparison target: part of Activity Monitor's header, directly under the toolbar.
 * Reference crop (2x pixels) x=560 y=188 w=340 h=48, i.e. 170 x 24 pt: the last 18 pt of the
 * 242 pt "Process Name" column, the 78 pt "% CPU" column (centred title, descending
 * indicator), the 73 pt "CPU Time" column and the start of the next. The header is
 * wider than the crop and shifted left by 224 pt.
 */
export default function VisualActivityMonitor() {
  return (
    <div style={{ position: "relative", overflow: "hidden", width: 170, height: 24 }}>
      {/* biome-ignore lint/a11y/useSemanticElements: a header alone needs a table to be a row of; table-view provides the grid */}
      <div
        role="table"
        aria-label="Processes"
        style={{ position: "absolute", left: -224, width: 839 }}
      >
        <TableHeader>
          <TableHeaderCell align="center" width={242} onSort={noop}>
            Process Name
          </TableHeaderCell>
          <TableHeaderCell align="center" width={78} sortDirection="descending" onSort={noop}>
            % CPU
          </TableHeaderCell>
          <TableHeaderCell align="center" width={73} onSort={noop}>
            CPU Time
          </TableHeaderCell>
          <TableHeaderCell align="center" onSort={noop}>
            Threads
          </TableHeaderCell>
        </TableHeader>
      </div>
    </div>
  );
}
