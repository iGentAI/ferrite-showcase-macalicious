import { TableHeader, TableHeaderCell } from "macalicious/table-header";

/**
 * Visual comparison target: the start of Console's header (variant "plain"), directly under
 * the toolbar. Reference crop (2x pixels) x=474 y=258 w=700 h=50, i.e. 350 x 25 pt: one point
 * of the content background (Console leaves it between the toolbar and the header), then the
 * 53 pt "Type", 173 pt "Time" and 63 pt "Process" columns and the start of "Message".
 */
export default function VisualConsole() {
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
        <TableHeader variant="plain">
          <TableHeaderCell width={53}>Type</TableHeaderCell>
          <TableHeaderCell width={173}>Time</TableHeaderCell>
          <TableHeaderCell width={63}>Process</TableHeaderCell>
          <TableHeaderCell>Message</TableHeaderCell>
        </TableHeader>
      </div>
    </div>
  );
}
