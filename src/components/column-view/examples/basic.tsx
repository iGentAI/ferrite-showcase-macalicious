import { ColumnView, type ColumnViewItem, ColumnViewPanel } from "macalicious/column-view";

// Stand-in icons, drawn here: a folder and a document.
const folder = (
  <svg viewBox="0 0 16 16" width="16" height="16" aria-hidden="true">
    <path d="M1 3h5l1.5 1.5H15V13H1z" fill="currentColor" opacity="0.5" />
  </svg>
);
const file = (
  <svg viewBox="0 0 16 16" width="16" height="16" aria-hidden="true">
    <path d="M3.5 1.5h6l3 3v10h-9z" fill="none" stroke="currentColor" opacity="0.6" />
  </svg>
);

const folders: Record<string, ColumnViewItem[]> = {
  root: [
    { id: "applications", label: "Applications", icon: folder, hasChildren: true },
    { id: "documents", label: "Documents", icon: folder, hasChildren: true },
    { id: "readme", label: "Read Me.txt", icon: file },
  ],
  applications: [
    { id: "calendar", label: "Calendar", icon: file },
    { id: "notes", label: "Notes", icon: file },
  ],
  documents: [
    { id: "letters", label: "Letters", icon: folder, hasChildren: true },
    { id: "budget", label: "Budget.numbers", icon: file },
  ],
  letters: [{ id: "draft", label: "Draft.pages", icon: file }],
};

// The same array for the same folder every time, so that a column only renders when it changes.
const getChildren = (id: string | number | null) => folders[id ?? "root"];

/** Click a row, or use the arrow keys: Right enters a folder, Left goes back. */
export default function Basic() {
  return (
    <ColumnView
      aria-label="Files"
      getChildren={getChildren}
      defaultPath={["documents", "budget"]}
      columnWidth={150}
      renderPreview={(item) => (
        <ColumnViewPanel style={{ gap: 4, padding: "24px 12px" }}>
          <strong>{item.label}</strong>
          <span style={{ color: "var(--mac-color-label-secondary)" }}>Document</span>
        </ColumnViewPanel>
      )}
      style={{ width: 460, maxWidth: "100%", height: 160 }}
    />
  );
}
