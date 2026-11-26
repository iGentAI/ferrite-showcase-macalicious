import { SplitView, SplitViewDivider, SplitViewPane } from "macalicious/split-view";

const pane = { padding: 8, font: "var(--mac-font-body)", color: "var(--mac-color-text)" };
const frame = { width: 200, height: 130, background: "var(--mac-color-control-background)" };

/** Three panes, a stacked split view, and the two wide divider styles. */
export default function Variants() {
  return (
    <div style={{ display: "flex", flexWrap: "wrap", gap: 20 }}>
      <SplitView style={frame}>
        <SplitViewPane defaultSize={50} minSize={30} style={pane}>
          A
        </SplitViewPane>
        <SplitViewDivider aria-label="Resize A" />
        <SplitViewPane style={pane}>B</SplitViewPane>
        <SplitViewDivider aria-label="Resize C" />
        <SplitViewPane defaultSize={50} minSize={30} style={pane}>
          C
        </SplitViewPane>
      </SplitView>
      <SplitView orientation="vertical" style={frame}>
        <SplitViewPane style={pane}>Table</SplitViewPane>
        <SplitViewDivider aria-label="Resize detail" />
        <SplitViewPane defaultSize={50} minSize={30} style={pane}>
          Detail
        </SplitViewPane>
      </SplitView>
      <SplitView dividerStyle="thick" style={{ ...frame, background: "none" }}>
        <SplitViewPane
          defaultSize={90}
          minSize={40}
          style={{ ...pane, background: "var(--mac-color-control-background)" }}
        >
          Thick
        </SplitViewPane>
        <SplitViewDivider aria-label="Resize thick" />
        <SplitViewPane style={{ ...pane, background: "var(--mac-color-control-background)" }} />
      </SplitView>
      <SplitView dividerStyle="pane-splitter" orientation="vertical" style={frame}>
        <SplitViewPane defaultSize={60} minSize={30} style={pane}>
          Pane splitter
        </SplitViewPane>
        <SplitViewDivider aria-label="Resize pane splitter" />
        <SplitViewPane style={pane} />
      </SplitView>
    </div>
  );
}
