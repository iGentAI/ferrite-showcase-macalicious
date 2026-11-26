import { TabView, TabViewList, TabViewPanel, TabViewTab } from "macalicious/tab-view";

/**
 * Visual comparison target: the tab strip of System Preferences › Energy Saver, last of two
 * tabs selected (the mirrored end cap). Reference crop (2x pixels) x=580 y=304 w=404 h=60,
 * i.e. 202 x 30 pt: the strip's alignment rectangle is 181 x 21 pt at (10, 4) pt. The
 * segments are given their measured widths (68 and 113 pt).
 */
export default function VisualEnergySaverTabs() {
  return (
    <div
      style={{
        position: "relative",
        overflow: "hidden",
        width: 202,
        height: 30,
        background: "light-dark(#ececec, #2f3031)",
      }}
    >
      <TabView
        defaultValue="adapter"
        style={{ position: "absolute", left: -190, top: 4, width: 581, height: 200 }}
      >
        <TabViewList aria-label="Energy Saver">
          <TabViewTab value="battery" style={{ width: 68, padding: 0 }}>
            Battery
          </TabViewTab>
          <TabViewTab value="adapter" style={{ width: 113, padding: 0 }}>
            Power Adapter
          </TabViewTab>
        </TabViewList>
        <TabViewPanel value="battery" />
        <TabViewPanel value="adapter" />
      </TabView>
    </div>
  );
}
