import { TableView, TableViewCellText, type TableViewColumn } from "macalicious/table-view";
import type { CSSProperties } from "react";

const ACCOUNT = "com.apple.account.AppleAccount.";
const rows = [
  ["<key>", "public key"],
  ["<key>", "private key"],
  ["Apple Persistent State Encryption", "application password"],
  ["BeaconStore", "application password"],
  [`${ACCOUNT}cloudkit-token`, "application password"],
  [`${ACCOUNT}find-my-friends-app-token`, "application password"],
  [`${ACCOUNT}find-my-iphone-app-token`, "application password"],
  [`${ACCOUNT}find-my-iphone-siri-token`, "application password"],
];

const columns: TableViewColumn[] = [
  { id: "0", title: "Name", width: 221, sortable: true },
  { id: "1", title: "Kind", width: 123, sortable: true },
  { id: "2", title: "Date Modified", width: 151, sortable: true },
  { id: "3", title: "Expires", sortable: true },
];

/* The header's hook: Keychain Access's titles start 3.5 pt from the column's edge. */
const table = {
  width: 702,
  height: 169,
  "--mac-table-header-title-inset": "3.5px 2px",
} as CSSProperties;

/**
 * Visual comparison target: the start of Keychain Access's item table with the line over its
 * header (`headerProps`) and its long names cut in their middle (`TableViewCellText`).
 * Reference crop (2x pixels) x=462 y=356 w=688 h=344, i.e. 344 x 172 pt: 3 pt of the pane
 * above, the 25 pt header and eight 18 pt rows, in the Name and Kind columns. Names start
 * 41 pt from the table's edge, after the icon column, whose artwork is not reproduced; what
 * the capture's ellipsis hides of a name is invented.
 */
export default function VisualKeychainItems() {
  return (
    <div
      style={{
        boxSizing: "border-box",
        overflow: "hidden",
        width: 344,
        height: 172,
        paddingTop: 3,
        background: "var(--mac-color-control-background-tinted)",
      }}
    >
      <TableView
        aria-label="Keychain items"
        columns={columns}
        rowCount={rows.length}
        renderCell={(row, column) =>
          column.id === "0" ? (
            <div style={{ display: "flex", paddingLeft: 38 }}>
              <TableViewCellText lineBreakMode="truncating-middle">
                {rows[row]?.[0] ?? ""}
              </TableViewCellText>
            </div>
          ) : (
            rows[row]?.[Number(column.id)]
          )
        }
        rowHeight={18}
        size="mini"
        alternatingRows
        value={[0]}
        sort={{ column: "0", direction: "ascending" }}
        headerProps={{ topBorder: true }}
        style={table}
      />
    </div>
  );
}
