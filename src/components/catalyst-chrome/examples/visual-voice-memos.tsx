import { CatalystChrome } from "macalicious/catalyst-chrome";
import { Toolbar, ToolbarSpace } from "macalicious/toolbar";
import { ToolbarButton } from "macalicious/toolbar-button";
import { Window } from "macalicious/window";
import { WindowControls } from "macalicious/window-controls";

/**
 * Visual comparison target: the whole top of the Voice Memos window, 789 x 60 pt: the 38 pt
 * toolbar over black content, which shows through the toolbar material in both appearances,
 * and 22 pt of the content.
 *
 * Reference crop (2x pixels) x=112 y=76 w=1578 h=120. The title is “New Recording 3”; the Trim
 * button (39 pt, disabled while nothing is recorded) ends 7.5 pt from the trailing edge. Its
 * glyph is a stand-in drawing, masked with the title in the tight comparison.
 */
export default function VisualVoiceMemos() {
  return (
    <div
      style={{
        position: "relative",
        width: 789,
        height: 60,
        overflow: "hidden",
        background: "white",
      }}
    >
      <Window width={789} height={630} style={{ position: "absolute" }}>
        <CatalystChrome
          title="New Recording 3"
          controls={<WindowControls />}
          underToolbar
          toolbar={
            <Toolbar aria-label="Voice Memos toolbar">
              <ToolbarSpace />
              <ToolbarButton aria-label="Trim" disabled style={{ width: 39 }}>
                <svg
                  width="14"
                  height="14"
                  viewBox="0 0 14 14"
                  aria-hidden="true"
                  focusable="false"
                >
                  <path d="M3.500 .500v10h10M.500 3.500h10v10" fill="none" stroke="currentColor" />
                </svg>
              </ToolbarButton>
            </Toolbar>
          }
        >
          <div style={{ height: 630, background: "#000" }} />
        </CatalystChrome>
      </Window>
    </div>
  );
}
