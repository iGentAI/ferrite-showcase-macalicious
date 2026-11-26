import { TableHeader, TableHeaderCell } from "macalicious/table-header";

/**
 * Visual comparison target: the start of Keychain Access's item table header, which is not
 * under a toolbar and so has a top border. Reference crop (2x pixels) x=462 y=356 w=694
 * h=56, i.e. 347 x 28 pt: 3 pt of the pane above, then the 25 pt header with the 221 pt
 * "Name" column (ascending indicator), the 123 pt "Kind" column and the first 3 pt of "Date
 * Modified". The pane above is the content background.
 */
export default function VisualKeychain() {
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
        <TableHeader topBorder>
          <TableHeaderCell width={221} sortDirection="ascending">
            Name
          </TableHeaderCell>
          <TableHeaderCell width={123}>Kind</TableHeaderCell>
          <TableHeaderCell width={151}>Date Modified</TableHeaderCell>
          <TableHeaderCell>Keychain</TableHeaderCell>
        </TableHeader>
      </div>
    </div>
  );
}
