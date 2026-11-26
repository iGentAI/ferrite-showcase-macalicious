import { TabView, TabViewList, TabViewPanel, TabViewTab } from "macalicious/tab-view";

/** The Sound pane's three tabs. Uncontrolled: the first tab is selected at first. */
export default function Basic() {
  return (
    <TabView defaultValue="effects" style={{ width: 420 }}>
      <TabViewList aria-label="Sound">
        <TabViewTab value="effects">Sound Effects</TabViewTab>
        <TabViewTab value="output">Output</TabViewTab>
        <TabViewTab value="input">Input</TabViewTab>
      </TabViewList>
      <TabViewPanel value="effects" style={{ minHeight: 60, font: "var(--mac-font-body)" }}>
        Select an alert sound:
      </TabViewPanel>
      <TabViewPanel value="output" style={{ minHeight: 60, font: "var(--mac-font-body)" }}>
        Select a device for sound output:
      </TabViewPanel>
      <TabViewPanel value="input" style={{ minHeight: 60, font: "var(--mac-font-body)" }}>
        Select a device for sound input:
      </TabViewPanel>
    </TabView>
  );
}
