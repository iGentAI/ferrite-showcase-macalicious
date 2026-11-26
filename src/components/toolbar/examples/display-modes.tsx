import { SystemImage } from "macalicious/system-image";
import { TitleBar } from "macalicious/title-bar";
import { Toolbar, ToolbarSpace } from "macalicious/toolbar";
import { ToolbarButton } from "macalicious/toolbar-button";
import { ToolbarLabelledItem } from "macalicious/toolbar-labelled-item";
import { ToolbarSearchField } from "macalicious/toolbar-search-field";
import { WindowControls } from "macalicious/window-controls";

/* A stand-in for Console's Clear glyph, which is not a system image. */
function Clear() {
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" aria-hidden="true">
      <path d="M3 3l8 8m0-8l-8 8" fill="none" stroke="currentColor" strokeWidth="1.2" />
    </svg>
  );
}

const modes = ["icon-only", "icon-and-label", "label-only"] as const;

/** The same toolbar in its three display modes. The bar grows by the height of the labels. */
export default function DisplayModes() {
  return (
    <div style={{ display: "grid", gap: 16 }}>
      {modes.map((mode) => (
        <TitleBar
          key={mode}
          variant="unified"
          title={mode}
          controls={<WindowControls />}
          style={{ width: 420 }}
        >
          <Toolbar displayMode={mode} aria-label={`Toolbar, ${mode}`}>
            <ToolbarLabelledItem label="Clear">
              <ToolbarButton style={{ width: 44 }}>
                <Clear />
              </ToolbarButton>
            </ToolbarLabelledItem>
            <ToolbarLabelledItem label="Reload">
              <ToolbarButton style={{ width: 44 }}>
                <SystemImage name="refresh" />
              </ToolbarButton>
            </ToolbarLabelledItem>
            <ToolbarLabelledItem label="Info">
              <ToolbarButton style={{ width: 44 }} disabled>
                <SystemImage name="info" />
              </ToolbarButton>
            </ToolbarLabelledItem>
            <ToolbarSpace />
            <ToolbarSearchField style={{ width: 140 }} />
          </Toolbar>
        </TitleBar>
      ))}
    </div>
  );
}
