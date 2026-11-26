import { SplitView, SplitViewDivider, SplitViewPane } from "macalicious/split-view";

const list = {
  boxSizing: "border-box" as const,
  background: "light-dark(#ffffff, #1d1e1f)",
};
const edge = "1px solid light-dark(#c5c5c5, #565656)";

/**
 * Visual comparison target: the thick divider between the Shared Folders and Users lists of
 * the Sharing pane (File Sharing selected), with its dimple.
 *
 * Reference crop (2x pixels) x=895 y=739 w=36 h=48, that is 18 x 24 pt: 4.5 pt of the left
 * list with its 1 pt edge, the clear 9 pt band (x 904..921) through which the pane's box shows
 * (#e3e3e3, Dark Aqua #353637), and 4.5 pt of the right list. The dimple is 6 pt across (x
 * 907..918, y 757..768), centred in the band and in the crop. The lists and their edges are
 * the example's own; the divider is the component's.
 */
export default function VisualThickDimple() {
  return (
    <SplitView
      dividerStyle="thick"
      style={{ width: 18, height: 24, background: "light-dark(#e3e3e3, #353637)" }}
    >
      <SplitViewPane size={4.5} style={{ ...list, borderInlineEnd: edge }} />
      <SplitViewDivider disabled />
      <SplitViewPane style={{ ...list, borderInlineStart: edge }} />
    </SplitView>
  );
}
