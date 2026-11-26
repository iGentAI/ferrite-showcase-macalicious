import { SplitView, SplitViewDivider, SplitViewPane } from "macalicious/split-view";

/**
 * Visual comparison target: the divider between the two opaque panes of System Information.
 * Reference crop (2x pixels) x=416 y=860 w=44 h=80, i.e. 22 x 40 pt: 11 pt of the list, the
 * 1 pt divider, 10 pt of the detail pane. Both panes are the content background (the dark
 * detail pane measures one level lower in blue than the list).
 */
export default function VisualOpaquePanes() {
  return (
    <SplitView style={{ width: 22, height: 40 }}>
      <SplitViewPane size={11} style={{ background: "light-dark(#ffffff, #1e1f20)" }} />
      <SplitViewDivider disabled />
      <SplitViewPane style={{ background: "light-dark(#ffffff, #1e1e1e)" }} />
    </SplitView>
  );
}
