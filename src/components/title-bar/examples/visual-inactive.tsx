import { SystemImage } from "macalicious/system-image";
import { TitleBar } from "macalicious/title-bar";
import { ToolbarButton } from "macalicious/toolbar-button";
import { Window } from "macalicious/window";
import { WindowControls } from "macalicious/window-controls";

/**
 * Visual comparison target: the inactive Safari window behind a Picture in Picture panel: flat
 * bar, grey window controls, outlined buttons.
 *
 * Reference crop 440 x 76 px (220 x 38 pt), 7 pt right of the window's corner and from its top
 * edge: x=330 y=104 in the light capture, x=358 y=78 in the dark one. Safari's tab bar follows
 * the bar, so its bottom rows are those of `divider="bar"`. The sidebar glyph is the
 * `sidebar` system image, a stand-in for Apple's, and is masked.
 */
export default function VisualInactive() {
  return (
    <div style={{ position: "relative", width: 220, height: 38, overflow: "hidden" }}>
      <Window state="inactive" width={1254} height={200} style={{ position: "absolute", left: -7 }}>
        <TitleBar variant="title-hidden" divider="bar" controls={<WindowControls />}>
          <div style={{ display: "flex", gap: 1, padding: 8 }}>
            <ToolbarButton aria-label="Back" style={{ padding: 0 }}>
              <SystemImage name="go-back" />
            </ToolbarButton>
            <ToolbarButton aria-label="Forward" disabled style={{ padding: 0 }}>
              <SystemImage name="go-forward" />
            </ToolbarButton>
            <ToolbarButton aria-label="Sidebar" style={{ width: 37, marginInlineStart: 9 }}>
              <SystemImage name="sidebar" />
            </ToolbarButton>
          </div>
        </TitleBar>
      </Window>
    </div>
  );
}
