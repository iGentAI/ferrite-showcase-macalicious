import { TabView, TabViewList, TabViewPanel, TabViewTab } from "macalicious/tab-view";

/**
 * Visual comparison target: the top-left corner of the content box of a tab view, from System
 * Preferences › Sound: the corner whose radius the measured spec fitted. Reference crop
 * (2x pixels) x=132 y=192 w=80 h=80, i.e. 40 x 40 pt, with the corner of the box 10 pt in from
 * the crop's corner. The strip sits on the box's top border further right, outside the crop,
 * and the box starts half a strip's height below the top of the tab view.
 */
export default function VisualPaneCorner() {
  return (
    <div
      style={{
        position: "relative",
        overflow: "hidden",
        width: 40,
        height: 40,
        background: "light-dark(#ececec, #2f3031)",
      }}
    >
      <TabView
        defaultValue="effects"
        style={{ position: "absolute", left: 10, top: 0, width: 629, height: 200 }}
      >
        <TabViewList aria-label="Sound">
          <TabViewTab value="effects">Sound Effects</TabViewTab>
          <TabViewTab value="output">Output</TabViewTab>
          <TabViewTab value="input">Input</TabViewTab>
        </TabViewList>
        <TabViewPanel value="effects" />
        <TabViewPanel value="output" />
        <TabViewPanel value="input" />
      </TabView>
    </div>
  );
}
