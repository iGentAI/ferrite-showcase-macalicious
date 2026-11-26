import { TabView, TabViewList, TabViewPanel, TabViewTab } from "macalicious/tab-view";

const tab = { height: 40, padding: 0 } as const;

/**
 * Visual check target for tabs on the left and on the right, which no screenshot shows. Two
 * 120 x 90 pt tab views, 20 pt apart, in a 280 x 110 pt box with 10 pt of padding. Each strip
 * is two 40 pt tabs, so it is 21 x 80 pt: the left one at x 10..31, the right one at
 * x 249..270, both at y 15..95, with the first tab (y 15..55) selected. The comparisons read
 * the selected tab's fill a quarter and three quarters of the way across the strip, where the
 * accent gradient has its second and fourth colour stops: the gradient must run from the
 * strip's outer edge to the edge that faces the content.
 */
export default function VisualSideTabs() {
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
