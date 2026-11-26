import { Toolbar } from "macalicious/toolbar";
import { ToolbarButton } from "macalicious/toolbar-button";
import { ToolbarLabelledItem } from "macalicious/toolbar-labelled-item";

const caption = {
  font: "var(--mac-font-label)",
  color: "var(--mac-color-label-secondary)",
  padding: "6px 8px 0",
} as const;

function Dot() {
  return (
    <svg width="12" height="12" viewBox="0 0 12 12" aria-hidden="true">
      <circle cx="6" cy="6" r="4.5" fill="none" stroke="currentColor" strokeWidth="1.2" />
    </svg>
  );
}

const modes = ["icon-and-label", "icon-only", "label-only"] as const;

/** The same two items in each of the toolbar's display modes. */
export default function DisplayModes() {
  return (
    <div style={{ display: "grid", background: "var(--mac-material-titlebar)", width: 260 }}>
      {modes.map((mode) => (
        <div key={mode}>
          <div style={caption}>{mode}</div>
          <Toolbar displayMode={mode} aria-label={`Toolbar, ${mode}`}>
            <ToolbarLabelledItem label="Clear">
              <ToolbarButton style={{ width: 44 }}>
                <Dot />
              </ToolbarButton>
            </ToolbarLabelledItem>
            <ToolbarLabelledItem label="Reload">
              <ToolbarButton style={{ width: 44 }} disabled>
                <Dot />
              </ToolbarButton>
            </ToolbarLabelledItem>
          </Toolbar>
        </div>
      ))}
    </div>
  );
}
