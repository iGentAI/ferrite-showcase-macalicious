import { TabView, TabViewList, TabViewPanel, TabViewTab } from "macalicious/tab-view";

const caption = {
  margin: "0 0 6px",
  font: "var(--mac-font-label)",
  color: "var(--mac-color-label-secondary)",
} as const;

/** Control sizes of the strip, and the other tab positions and borders. */
export default function Sizes() {
  return (
    <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 220px)", gap: "16px 24px" }}>
      {(["regular", "small", "mini"] as const).map((size) => (
        <div key={size}>
          <p style={caption}>{size}</p>
          <TabView size={size} defaultValue="a">
            <TabViewList aria-label={`Size ${size}`}>
              <TabViewTab value="a">Point &amp; Click</TabViewTab>
              <TabViewTab value="b">Scroll</TabViewTab>
            </TabViewList>
            <TabViewPanel value="a" style={{ minHeight: 20 }} />
            <TabViewPanel value="b" style={{ minHeight: 20 }} />
          </TabView>
        </div>
      ))}
      {(["bottom", "left", "right"] as const).map((position) => (
        <div key={position}>
          <p style={caption}>Tabs on the {position}</p>
          <TabView tabPosition={position} defaultValue="a" style={{ minHeight: 90 }}>
            <TabViewList aria-label={`Tabs on the ${position}`}>
              <TabViewTab value="a">One</TabViewTab>
              <TabViewTab value="b">Two</TabViewTab>
            </TabViewList>
            <TabViewPanel value="a" />
            <TabViewPanel value="b" />
          </TabView>
        </div>
      ))}
      {(["line", "none"] as const).map((border) => (
        <div key={border}>
          <p style={caption}>Border: {border}</p>
          <TabView border={border} defaultValue="a">
            <TabViewList aria-label={`Border ${border}`}>
              <TabViewTab value="a">One</TabViewTab>
              <TabViewTab value="b">Two</TabViewTab>
            </TabViewList>
            <TabViewPanel value="a" style={{ minHeight: 20 }} />
            <TabViewPanel value="b" style={{ minHeight: 20 }} />
          </TabView>
        </div>
      ))}
    </div>
  );
}
