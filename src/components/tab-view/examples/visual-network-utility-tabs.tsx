import { TabView, TabViewList, TabViewPanel, TabViewTab } from "macalicious/tab-view";

const TABS = [
  ["Info", 47],
  ["Netstat", 67],
  ["Ping", 49],
  ["Lookup", 67],
  ["Traceroute", 88],
  ["Whois", 60],
  ["Finger", 61],
  ["Port Scan", 84],
] as const;

/**
 * Visual comparison target: the eight tabs of Network Utility across the whole width of its
 * window, first tab selected. Reference crop (2x pixels) x=112 y=136 w=1288 h=60, i.e.
 * 644 x 30 pt: the strip's alignment rectangle is 523 x 21 pt at (61, 4) pt (bezel edges at
 * x=235 and x=1278 on row 150). The segments are given their measured widths (dividers at
 * x=462, 560, 694, 870, 990 and 1112; the selected tab ends at x=327). The content box runs
 * from one window edge to the other, so the tab view is wider than the crop and its sides are
 * cut off.
 */
export default function VisualNetworkUtilityTabs() {
  return (
    <div
      style={{
        position: "relative",
        overflow: "hidden",
        width: 644,
        height: 30,
        background: "light-dark(#ececec, #2f3031)",
      }}
    >
      <TabView
        defaultValue="Info"
        style={{ position: "absolute", left: -28, top: 4, width: 701, height: 200 }}
      >
        <TabViewList aria-label="Network Utility">
          {TABS.map(([title, width]) => (
            <TabViewTab key={title} value={title} style={{ width, padding: 0 }}>
              {title}
            </TabViewTab>
          ))}
        </TabViewList>
        {TABS.map(([title]) => (
          <TabViewPanel key={title} value={title} />
        ))}
      </TabView>
    </div>
  );
}
