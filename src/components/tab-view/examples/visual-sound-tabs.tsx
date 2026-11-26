import { TabView, TabViewList, TabViewPanel, TabViewTab } from "macalicious/tab-view";

/**
 * Visual comparison target: the tab strip of System Preferences › Sound and the top border of
 * its content box, first of three tabs selected. Reference crop (2x pixels) x=532 y=184 w=496
 * h=60, i.e. 248 x 30 pt: the strip's alignment rectangle is 229 x 21 pt at (10, 4) pt and the
 * box's top border is 14 pt down. The segments are given their measured widths (109, 65 and
 * 55 pt), because the titles are set in the fallback font off Apple platforms. The tab view is
 * wider than the crop and is cut off by it.
 */
export default function VisualSoundTabs() {
  return (
    <div
      style={{
        position: "relative",
        overflow: "hidden",
        width: 248,
        height: 30,
        background: "light-dark(#ececec, #2f3031)",
      }}
    >
      <TabView
        defaultValue="effects"
        style={{ position: "absolute", left: -190, top: 4, width: 629, height: 200 }}
      >
        <TabViewList aria-label="Sound">
          <TabViewTab value="effects" style={{ width: 109, padding: 0 }}>
            Sound Effects
          </TabViewTab>
          <TabViewTab value="output" style={{ width: 65, padding: 0 }}>
            Output
          </TabViewTab>
          <TabViewTab value="input" style={{ width: 55, padding: 0 }}>
            Input
          </TabViewTab>
        </TabViewList>
        <TabViewPanel value="effects" />
        <TabViewPanel value="output" />
        <TabViewPanel value="input" />
      </TabView>
    </div>
  );
}
