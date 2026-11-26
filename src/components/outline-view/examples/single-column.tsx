import { OutlineView, type OutlineViewItem } from "macalicious/outline-view";

interface Family extends OutlineViewItem {
  name: string;
}

const fonts: Family[] = [
  { id: "yuppy", name: "Yuppy TC", dimmed: true, children: [{ id: "yuppy-r", name: "Regular" }] },
  { id: "zapf", name: "Zapf Dingbats", children: [{ id: "zapf-r", name: "Regular" }] },
  { id: "zapfino", name: "Zapfino", children: [{ id: "zapfino-r", name: "Regular" }] },
];

/** A single-column outline without a header, as Font Book's font list, with a dimmed row. */
export default function SingleColumn() {
  return (
    <OutlineView
      aria-label="Fonts"
      items={fonts}
      renderCell={(item) => item.name}
      getItemLabel={(item) => item.name}
      defaultExpanded={["zapf"]}
      defaultValue={["zapf-r"]}
      rowHeight={18}
      style={{ width: 200, height: 100 }}
    />
  );
}
