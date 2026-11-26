import { TabView, TabViewList, TabViewPanel, TabViewTab } from "macalicious/tab-view";

const tab = { height: 40, padding: 0 } as const;

/**
 * Visual check target for side tabs in right-to-left text: the two tab views of
 * `visual-side-tabs`, each with `dir="rtl"`. Left and right are physical sides, so the picture
 * is the same as there: the left strip at x 10..31, the right one at x 249..270, the content
 * box beside each, and the first tab at the top (y 15..55), selected.
 */
export default function VisualSideTabsRtl() {
  return (
    <div
      style={{
        display: "flex",
        gap: 20,
        boxSizing: "border-box",
        width: 280,
        height: 110,
        padding: 10,
        background: "light-dark(#ececec, #2f3031)",
      }}
    >
      {(["left", "right"] as const).map((position) => (
        <TabView
          key={position}
          dir="rtl"
          tabPosition={position}
          defaultValue="a"
          style={{ width: 120, height: 90 }}
        >
          <TabViewList aria-label={`Tabs on the ${position}`}>
            <TabViewTab value="a" style={tab}>
              One
            </TabViewTab>
            <TabViewTab value="b" style={tab}>
              Two
            </TabViewTab>
          </TabViewList>
          <TabViewPanel value="a" />
          <TabViewPanel value="b" />
        </TabView>
      ))}
    </div>
  );
}
