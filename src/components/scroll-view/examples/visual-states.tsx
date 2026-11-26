import { ScrollView, type ScrollViewProps } from "macalicious/scroll-view";

function Cell(props: ScrollViewProps) {
  return (
    <ScrollView
      style={{ width: 40, height: 60, background: "light-dark(#ffffff, #1e1e1e)" }}
      {...props}
    >
      <div style={{ height: 120 }} />
    </ScrollView>
  );
}

/**
 * Visual check target for the states no screenshot shows: four 40 x 60 pt scroll views side
 * by side on their content background. From the left: overlay knob in the default style;
 * overlay with the pointer over it (track and wide knob); legacy; legacy at the small size.
 * Each knob is half of its track (28 pt of 56) and at the top.
 */
export default function VisualStates() {
  return (
    <div style={{ display: "flex", width: 160, height: 60 }}>
      <Cell data-force="scrolling" />
      <Cell data-force="hover" />
      <Cell scrollerStyle="legacy" />
      <Cell scrollerStyle="legacy" size="small" />
    </div>
  );
}
