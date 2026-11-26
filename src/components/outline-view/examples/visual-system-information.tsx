import { OutlineView, type OutlineViewItem } from "macalicious/outline-view";

interface Section extends OutlineViewItem {
  name: string;
}

const names = ["ATA", "Apple Pay", "Audio", "Bluetooth", "Camera", "Card Reader"];
const sections: Section[] = [
  {
    id: "hardware",
    name: "Hardware",
    children: names.map((name) => ({ id: name, name })),
  },
];

/**
 * Visual comparison target: the top of System Information's outline, whose expanded parent
 * "Hardware" is selected while the outline has the keyboard focus (white triangle).
 * Reference crop (2x pixels) x=114 y=120 w=324 h=224, i.e. 162 x 112 pt: seven 16 pt rows of
 * 11 pt text on the content background. The crop starts 1 pt inside the pane, after the
 * window's edge highlight, so the outline is shifted left by 1 pt.
 */
export default function VisualSystemInformation() {
  return (
    <div style={{ position: "relative", overflow: "hidden", width: 162, height: 112 }}>
      <OutlineView
        aria-label="System report"
        data-force="focus"
        items={sections}
        renderCell={(item) => item.name}
        expanded={["hardware"]}
        value={["hardware"]}
        rowHeight={16}
        size="mini"
        style={{ position: "absolute", left: -1, width: 163, height: 112 }}
      />
    </div>
  );
}
