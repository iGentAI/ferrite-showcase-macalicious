import { InspectorPanelSection } from "macalicious/inspector-panel";

/**
 * Visual comparison target: two section headers of Finder's Info window, Comments collapsed
 * and Open with expanded, with the separators above them. Reference crop (2x pixels) x=114
 * y=1086 w=526 h=84, i.e. 263 x 42 pt inside the window frame (the dark capture has the
 * window's rim in the outermost point on each side).
 */
export default function VisualSectionHeaders() {
  return (
    <div
      style={{
        width: 263,
        height: 42,
        overflow: "hidden",
        background: "var(--mac-color-window-background)",
        color: "var(--mac-color-text)",
        font: "var(--mac-font-subheadline)",
      }}
    >
      <div style={{ width: 265, marginInlineStart: -1 }}>
        <InspectorPanelSection title="Comments:">Comments</InspectorPanelSection>
        <InspectorPanelSection title="Open with:" defaultOpen>
          Open with
        </InspectorPanelSection>
      </div>
    </div>
  );
}
