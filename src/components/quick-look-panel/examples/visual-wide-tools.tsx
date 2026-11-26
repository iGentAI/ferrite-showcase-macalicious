import { QuickLookPanel, QuickLookPanelButton } from "macalicious/quick-look-panel";

/**
 * Visual check, without a reference: tools wider than the bar stay between the close button
 * and the actions, and scroll there. The tools are stood in for by a magenta strip twice as
 * wide as the panel, so that the check can read where it ends; the panel stands on white, over
 * which the bar's material is a flat colour.
 */
export default function VisualWideTools() {
  return (
    <div style={{ width: 300, height: 38, overflow: "hidden", background: "#ffffff" }}>
      <QuickLookPanel
        width={300}
        height={200}
        title="Wave.jpg"
        tools={<div style={{ width: 600, height: 20, background: "#ff00ff" }} />}
        actions={
          <QuickLookPanelButton style={{ width: 120, padding: 0 }}>Done</QuickLookPanelButton>
        }
      />
    </div>
  );
}
