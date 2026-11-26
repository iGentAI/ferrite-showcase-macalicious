import { Window } from "macalicious/window";

/**
 * Visual comparison target: the top edge of a window that has no title bar, over a sidebar
 * that reaches it, as in App Store. 60 x 10 pt of the edge, 100 pt from the window's left, where
 * the capture shows nothing but the sidebar's fill under the two highlight rows.
 *
 * Reference crop x=312 y=76 w=120 h=20 of the App Store captures (the window is at 112, 76).
 * The sidebar here is the opaque sidebar fill, which is what the captures' sidebar measures.
 */
export default function VisualTopHighlight() {
  return (
    <div style={{ position: "relative", width: 60, height: 10, overflow: "hidden" }}>
      <Window
        topHighlight
        aria-label="App Store"
        width={400}
        height={200}
        style={{ position: "absolute", left: -100, top: 0 }}
      >
        <div style={{ flex: 1, background: "var(--mac-material-sidebar-opaque)" }} />
      </Window>
    </div>
  );
}
