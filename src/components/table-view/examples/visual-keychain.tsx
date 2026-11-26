import { TableView, type TableViewColumn } from "macalicious/table-view";

const rows = [
  ["<key>", "public key", "--"],
  ["<key>", "private key", "--"],
  ["Apple Persistent State Encryption", "application password", "Today, 8:59 AM"],
  ["BeaconStore", "application password", "Sep 29, 2019 at 6:21:13 PM"],
];

const columns: TableViewColumn[] = [
  { id: "0", title: "Name", width: 221, sortable: true },
  { id: "1", title: "Kind", width: 123 },
  { id: "2", title: "Date Modified", width: 151 },
  { id: "3", title: "Expires" },
];

/**
 * Visual comparison target: the start of Keychain Access's item table, whose first row is
 * selected while the table does not have the keyboard focus (grey selection). Reference crop
 * (2x pixels) x=462 y=364 w=900 h=192, i.e. 450 x 96 pt, starting under the header's top
 * border: the header and four 18 pt rows of 11 pt text. Names start 42 pt from the table's
 * edge, after the icon column, whose artwork is not reproduced.
 */
export default function VisualKeychain() {
  return (
    <div style={{ overflow: "hidden", width: 450, height: 96 }}>
      <TableView
        aria-label="Keychain items"
        columns={columns}
        rowCount={rows.length}
        renderCell={(row, column) =>
          column.id === "0" ? (
            <div style={{ paddingLeft: 39 }}>{rows[row]?.[0]}</div>
          ) : (
            rows[row]?.[Number(column.id)]
          )
        }
        rowHeight={18}
        size="mini"
        alternatingRows
        value={[0]}
        sort={{ column: "0", direction: "ascending" }}
        style={{ width: 702, height: 96 }}
      />
    </div>
  );
}
