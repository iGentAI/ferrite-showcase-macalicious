import { SplitView, SplitViewDivider, SplitViewPane } from "macalicious/split-view";
import type { CSSProperties } from "react";

/**
 * Visual comparison target: the divider between the Notes sidebar and its note list.
 * Reference crop (2x pixels) x=470 y=1140 w=44 h=80, i.e. 22 x 40 pt: 11 pt of the sidebar,
 * the 1 pt divider, 10 pt of the list. Beside a vibrant sidebar the Aqua divider is lighter
 * than between opaque panes, which `--mac-split-view-divider-color` sets here. The list's
 * paper texture in Aqua is a noise pattern; the example paints its mean colour.
 */
export default function VisualSidebarDivider() {
  return (
    <SplitView
      style={
        {
          width: 22,
          height: 40,
          "--mac-split-view-divider-color": "light-dark(#cecfcf, #000000)",
        } as CSSProperties
      }
    >
      <SplitViewPane size={11} style={{ background: "light-dark(#e6e7e7, #2c2d2e)" }} />
      <SplitViewDivider disabled />
      <SplitViewPane style={{ background: "light-dark(#faf9f7, #1e1f21)" }} />
    </SplitView>
  );
}
