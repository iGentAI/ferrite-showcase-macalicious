import { SplitView, SplitViewDivider, SplitViewPane } from "macalicious/split-view";

/**
 * Visual check target: a 100 x 40 pt split view on the window background whose first pane
 * is 40 pt wide, with a draggable divider. The comparisons drag it, move it with the
 * keyboard and focus it.
 */
export default function VisualInteractive() {
  return (
    <div style={{ width: 100, height: 40, background: "light-dark(#ececec, #323232)" }}>
      <SplitView style={{ width: 100, height: 40 }}>
        <SplitViewPane
          defaultSize={40}
          minSize={20}
          maxSize={70}
          style={{ background: "light-dark(#ffffff, #1e1e1e)" }}
        />
        <SplitViewDivider aria-label="Resize" />
        <SplitViewPane />
      </SplitView>
    </div>
  );
}
