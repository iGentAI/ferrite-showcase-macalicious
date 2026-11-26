import { ToolbarButton } from "macalicious/toolbar-button";

const BUTTON = { width: 24, minWidth: 24, padding: 0 };

/**
 * Visual comparison target: the two toolbar buttons of Keychain Access, laid out by their
 * bezels with `frame="bezel"`.
 *
 * Reference crop (2x pixels) x=256 y=84 w=140 h=60, i.e. 70 x 30 pt, 72 pt right of and 4 pt
 * below the window's top-left corner, on the 38 pt bar (37 pt over its last row). The row of
 * buttons starts 78 pt from the window's edge with the toolbar's 8 pt between them, the same
 * in both appearances; their fills are 24 pt wide, a point less than the button's least
 * width, and 4 pt below the crop's top. In Aqua the fills then
 * start at 78.5 and 111.5 pt, behind the hairline border, and in Dark Aqua at 78 and 110 pt,
 * as measured. The two glyphs are stand-in drawings; the tight comparisons mask them.
 */
export default function VisualKeychainButtons() {
  return (
    <div style={{ position: "relative", width: 70, height: 30, overflow: "hidden" }}>
      <div
        style={{
          position: "absolute",
          inset: "-4px 0 auto",
          height: 37,
          background: "var(--mac-material-titlebar)",
        }}
      />
      <div style={{ position: "absolute", left: 6, top: 4, display: "flex", gap: 8 }}>
        <ToolbarButton aria-label="New Keychain Item" frame="bezel" style={BUTTON}>
          <svg width="11" height="11" viewBox="0 0 11 11" aria-hidden="true">
            <path d="M5.5 0v11M0 5.5h11" stroke="currentColor" />
          </svg>
        </ToolbarButton>
        <ToolbarButton aria-label="Info" frame="bezel" style={BUTTON}>
          <svg width="15" height="15" viewBox="0 0 15 15" aria-hidden="true">
            <circle cx="7.5" cy="7.5" r="7" fill="none" stroke="currentColor" />
            <path d="M7.5 6.5v4.5M7.5 4v1" stroke="currentColor" strokeWidth="1.4" />
          </svg>
        </ToolbarButton>
      </div>
    </div>
  );
}
