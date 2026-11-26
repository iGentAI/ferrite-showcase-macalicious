import { TabView, TabViewList, TabViewPanel, TabViewTab } from "macalicious/tab-view";

/**
 * Visual comparison target: the four tabs of System Preferences › Security & Privacy and the
 * top border of the content box, first tab selected. Reference crop (2x pixels) x=478 y=194
 * w=604 h=60, i.e. 302 x 30 pt: the strip's alignment rectangle is 282 x 21 pt at (10, 4) pt
 * (bezel edges at x=499 and x=1060 on row 209). The segments are given their measured widths
 * (72, 73, 68 and 69 pt: dividers at x=788 and x=924, the selected tab ends at x=641), because
 * the titles are set in the fallback font off Apple platforms. The tab view is wider than the
 * crop and is cut off by it.
 */
export default function VisualSecurityTabs() {
  return (
    <div
      style={{
        position: "relative",
        overflow: "hidden",
        width: 302,
        height: 30,
        background: "light-dark(#ececec, #2f3031)",
      }}
    >
      <TabView
        defaultValue="general"
        style={{ position: "absolute", left: -164, top: 4, width: 630, height: 200 }}
      >
        <TabViewList aria-label="Security & Privacy">
          <TabViewTab value="general" style={{ width: 72, padding: 0 }}>
            General
          </TabViewTab>
          <TabViewTab value="filevault" style={{ width: 73, padding: 0 }}>
            FileVault
          </TabViewTab>
          <TabViewTab value="firewall" style={{ width: 68, padding: 0 }}>
            Firewall
          </TabViewTab>
          <TabViewTab value="privacy" style={{ width: 69, padding: 0 }}>
            Privacy
          </TabViewTab>
        </TabViewList>
        <TabViewPanel value="general" />
        <TabViewPanel value="filevault" />
        <TabViewPanel value="firewall" />
        <TabViewPanel value="privacy" />
      </TabView>
    </div>
  );
}
