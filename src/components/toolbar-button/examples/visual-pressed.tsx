import { TitleBar } from "macalicious/title-bar";
import { ToolbarButton } from "macalicious/toolbar-button";

/**
 * Visual comparison target: a pressed toolbar button, as Safari's Share button is drawn while
 * its menu is open (Safari-v13-Sharing screenshots): 50 x 18 pt of the toolbar from 1 pt below
 * the window's top edge, with the upper half of the 37 x 22 pt bezel, 5.5 pt in and 7 pt down,
 * on the title bar's material. The stage ends where the open menu's shadow begins to darken
 * the capture; the Share Menu page compares the whole bezel with its menu open.
 *
 * Reference crops (2x pixels): Aqua x=2274 y=37 w=100 h=36, Dark Aqua x=2292 y=21 w=100 h=36.
 * The glyph is a stand-in for Safari's and is masked.
 */
export default function VisualPressed() {
  return (
    <div style={{ position: "relative", width: 50, height: 18, overflow: "hidden" }}>
      <TitleBar
        variant="title-hidden"
        style={{ position: "absolute", top: -1, left: -40, right: -40, height: 38 }}
      />
      <ToolbarButton
        aria-label="Share"
        data-force="pressed"
        style={{ position: "absolute", left: 5.5, top: 7, width: 37 }}
      >
        <svg width="12" height="14" viewBox="0 0 12 14" aria-hidden="true" focusable="false">
          <path
            d="M6 9V1M3 3.500 6 .750l3 2.750M3.500 5.500h-2v7h9v-7h-2"
            fill="none"
            stroke="currentColor"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </ToolbarButton>
    </div>
  );
}
