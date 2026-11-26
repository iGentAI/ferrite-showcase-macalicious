import { OutlineView, type OutlineViewItem } from "macalicious/outline-view";

interface Entry extends OutlineViewItem {
  name: string;
  kind: string;
}

const items: Entry[] = [
  {
    id: "documents",
    name: "Documents",
    kind: "Folder",
    children: [
      { id: "budget", name: "Budget.numbers", kind: "Numbers spreadsheet" },
      {
        id: "letters",
        name: "Letters",
        kind: "Folder",
        children: [{ id: "bank", name: "Bank.pages", kind: "Pages document" }],
      },
    ],
  },
  { id: "pictures", name: "Pictures", kind: "Folder", children: [] },
  { id: "notes", name: "Notes.txt", kind: "Plain text" },
];

/** Click a triangle, or select a row and press Right or Left Arrow. */
export default function Basic() {
  return (
    <OutlineView
      aria-label="Files"
      items={items}
      columns={[
        { id: "name", title: "Name", width: 200 },
        { id: "kind", title: "Kind" },
      ]}
      renderCell={(item, column) => (column.id === "name" ? item.name : item.kind)}
      getItemLabel={(item) => item.name}
      defaultExpanded={["documents"]}
      defaultValue={["budget"]}
      rowHeight={18}
      alternatingRows
      style={{ width: 380, height: 150 }}
    />
  );
}
