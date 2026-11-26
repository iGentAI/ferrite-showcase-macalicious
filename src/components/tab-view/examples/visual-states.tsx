import { TabView, TabViewList, TabViewPanel, TabViewTab } from "macalicious/tab-view";

const tab = { width: 60, padding: 0 } as const;

/**
 * Fixture for the states of top tabs that no reference screenshot shows (pressed, keyboard
 * focus, a window that is not key, another accent). `tab-view.visual.json` puts it into each
 * state with real input and checks the pixels it expects.
 *
 * 196 x 53 pt with 8 pt of padding, so the focus ring is inside the capture. The strip's
 * alignment rectangle is x 8 to 188, y 8 to 29: three 60 pt tabs, the first selected. The
 * bezel is one hairline inside it, so its middle row, where the accent gradient has its
 * middle stop, is y 18.5. The titles are centred in their tabs; the points read are 6 pt
 * from a tab's leading edge, clear of the title.
 */
export default function VisualStates() {
  return (
    <div
      style={{
        boxSizing: "border-box",
        width: 196,
        height: 53,
        padding: 8,
        background: "light-dark(#ececec, #2f3031)",
      }}
    >
      <TabView defaultValue="one" style={{ width: 180, height: 37 }}>
        <TabViewList aria-label="States">
          <TabViewTab id="one" value="one" style={tab}>
            One
          </TabViewTab>
          <TabViewTab id="two" value="two" style={tab}>
            Two
          </TabViewTab>
          <TabViewTab id="three" value="three" style={tab}>
            Three
          </TabViewTab>
        </TabViewList>
        <TabViewPanel value="one" />
        <TabViewPanel value="two" />
        <TabViewPanel value="three" />
      </TabView>
    </div>
  );
}
