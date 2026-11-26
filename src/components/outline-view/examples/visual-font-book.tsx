import { OutlineView, type OutlineViewItem } from "macalicious/outline-view";

interface Family extends OutlineViewItem {
  name: string;
}

const fonts: Family[] = [
  { id: "yuppy-sc", name: "Yuppy SC", dimmed: true, children: [] },
  { id: "yuppy", name: "Yuppy TC", dimmed: true, children: [] },
  { id: "zapf", name: "Zapf Dingbats", children: [{ id: "zapf-r", name: "Regular" }] },
  { id: "zapfino", name: "Zapfino", children: [] },
];

/**
 * Visual comparison target: the end of Font Book's font list, where "Regular" under the
 * expanded "Zapf Dingbats" is selected while the list has the keyboard focus. Reference crop
 * (2x pixels) x=514 y=1138 w=400 h=140, i.e. 200 x 70 pt: the last four 18 pt rows of 13 pt
 * text, ending 2 pt above the window's bottom edge. The list is 2 pt taller than the crop and starts
 * above it, as the first row is cut by the crop. Font Book indents by 15.5 pt.
 */
export default function VisualFontBook() {
  return (
    <div style={{ position: "relative", overflow: "hidden", width: 200, height: 70 }}>
      <OutlineView
        aria-label="Fonts"
        data-force="focus"
        items={fonts}
        renderCell={(item) => item.name}
        expanded={["zapf"]}
        value={["zapf-r"]}
        rowHeight={18}
        indentation={15.5}
        style={{ position: "absolute", top: -18, left: 0, width: 200, height: 90 }}
      />
    </div>
  );
}
