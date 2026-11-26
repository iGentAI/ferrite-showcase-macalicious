import { SplitView, SplitViewDivider, SplitViewPane } from "macalicious/split-view";

/**
 * Visual comparison target: the horizontal divider between Console's table and its detail
 * pane. Reference crop (2x pixels) x=1800 y=518 w=80 h=32, i.e. 40 x 16 pt: 6 pt of the
 * table's last (striped) row, the 1 pt divider, 9 pt of the detail pane.
 */
export default function VisualStacked() {
  return (
    <SplitView orientation="vertical" style={{ width: 40, height: 16 }}>
      <SplitViewPane size={6} style={{ background: "light-dark(#f4f5f5, #292a2a)" }} />
      <SplitViewDivider disabled />
      <SplitViewPane style={{ background: "light-dark(#ffffff, #1e1f20)" }} />
    </SplitView>
  );
}
