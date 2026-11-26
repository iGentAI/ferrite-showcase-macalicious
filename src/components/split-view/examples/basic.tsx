import { SplitView, SplitViewDivider, SplitViewPane } from "macalicious/split-view";

const pane = { padding: 12, font: "var(--mac-font-body)", color: "var(--mac-color-text)" };

/** Drag the divider, or focus it and use the arrow keys. Double-click it to hide the list. */
export default function Basic() {
  return (
    <SplitView
      style={{ width: 420, height: 160, background: "var(--mac-color-control-background)" }}
    >
      <SplitViewPane defaultSize={140} minSize={80} maxSize={260} collapsible style={pane}>
        List
      </SplitViewPane>
      <SplitViewDivider aria-label="Resize list" />
      <SplitViewPane style={pane}>Detail</SplitViewPane>
    </SplitView>
  );
}
