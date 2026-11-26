import { ColumnView, type ColumnViewItem } from "macalicious/column-view";

// 5,000 folders in the first column, and 5,000 documents in each of them. The arrays are made
// once, so every call returns the same one.
const number = (index: number) => String(index + 1).padStart(4, "0");
const folders: ColumnViewItem[] = Array.from({ length: 5000 }, (_, index) => ({
  id: `f${index}`,
  label: `Folder ${number(index)}`,
  hasChildren: true,
}));
const documents: ColumnViewItem[] = Array.from({ length: 5000 }, (_, index) => ({
  id: `d${index}`,
  label: `Document ${number(index)}`,
}));
const getChildren = (parent: string | number | null) => (parent === null ? folders : documents);

/** Long columns: only the rows in view are in the document. */
export default function Large() {
  return (
    <ColumnView
      aria-label="Five thousand folders"
      getChildren={getChildren}
      defaultPath={["f0"]}
      columnWidth={180}
      style={{ width: 460, maxWidth: "100%", height: 216 }}
    />
  );
}
