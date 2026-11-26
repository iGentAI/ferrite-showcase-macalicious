import { TitleBar } from "macalicious/title-bar";
import { Toolbar } from "macalicious/toolbar";
import { ToolbarButton } from "macalicious/toolbar-button";
import { ToolbarLabelledItem } from "macalicious/toolbar-labelled-item";
import { Window } from "macalicious/window";
import { WindowControls } from "macalicious/window-controls";

/* Label and the position of the control's leading edge, in points from the window's edge. */
const items = [
  ["Now", 8],
  ["Activities", 62],
  ["Clear", 156],
  ["Reload", 208],
  ["Info", 300],
  ["Share", 361],
] as const;

/**
 * Visual comparison target: the icon-and-label toolbar of the Console window.
 *
 * Reference crop x=112 y=76 w=818 h=136 (409 x 68 pt): the window's top-left corner and the
 * first six toolbar items. Each control is 44 pt wide and starts 25 pt below the window's top;
 * the labels' baselines are 13 pt under the controls. Console spaces its items irregularly, so
 * this fixture places each item where the capture has it. The glyphs are application artwork
 * and are replaced by a plain mark; glyphs, labels and the title are masked in the tight
 * comparison.
 */
export default function VisualConsole() {
  return (
    <div
      style={{
        position: "relative",
        width: 409,
        height: 68,
        overflow: "hidden",
        background: "white",
      }}
    >
      <Window width={1000} height={200} style={{ position: "absolute" }}>
        <TitleBar variant="unified" divider="bar" controls={<WindowControls />}>
          <Toolbar displayMode="icon-and-label" aria-label="Toolbar" style={{ height: 46 }}>
            {items.map(([label, x]) => (
              <ToolbarLabelledItem
                key={label}
                label={label}
                style={{ position: "absolute", left: x, width: 44 }}
              >
                <ToolbarButton style={{ width: 44 }}>
                  <svg width="12" height="12" viewBox="0 0 12 12" aria-hidden="true">
                    <circle
                      cx="6"
                      cy="6"
                      r="4.5"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="1.2"
                    />
                  </svg>
                </ToolbarButton>
              </ToolbarLabelledItem>
            ))}
          </Toolbar>
        </TitleBar>
      </Window>
    </div>
  );
}
