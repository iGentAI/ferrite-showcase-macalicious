import { SystemImage } from "macalicious/system-image";
import { TitleBar } from "macalicious/title-bar";
import { Toolbar, ToolbarSpace } from "macalicious/toolbar";
import { ToolbarButton } from "macalicious/toolbar-button";
import { ToolbarSearchField } from "macalicious/toolbar-search-field";
import { WindowControls } from "macalicious/window-controls";

const caption = {
  font: "var(--mac-font-label)",
  color: "var(--mac-color-label-secondary)",
  marginBottom: 4,
} as const;

function Page() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" aria-hidden="true">
      <path d="M3.5 1.5h6l3 3v10h-9z" fill="white" stroke="gray" />
    </svg>
  );
}

/** The four layouts, each in a key and an inactive window. */
export default function Variants() {
  return (
    <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 300px)", gap: "16px 20px" }}>
      {(["key", "inactive"] as const).map((state) => (
        <div key={state} data-window-state={state} style={{ display: "grid", gap: 12 }}>
          <div>
            <div style={caption}>standard, {state}</div>
            <TitleBar title="Notes.txt" icon={<Page />} controls={<WindowControls />} />
          </div>
          <div>
            <div style={caption}>unified, {state}</div>
            <TitleBar variant="unified" title="Documents" controls={<WindowControls />}>
              <Toolbar aria-label={`Unified toolbar, ${state}`}>
                <ToolbarButton aria-label="Sidebar" style={{ width: 37 }}>
                  <SystemImage name="sidebar" />
                </ToolbarButton>
                <ToolbarSpace />
                <ToolbarSearchField style={{ width: 120 }} />
              </Toolbar>
            </TitleBar>
          </div>
          <div>
            <div style={caption}>title-hidden, {state}</div>
            <TitleBar variant="title-hidden" title="General" controls={<WindowControls />}>
              <Toolbar aria-label={`Title-hidden toolbar, ${state}`}>
                <ToolbarButton aria-label="Sidebar" style={{ width: 37 }}>
                  <SystemImage name="sidebar" />
                </ToolbarButton>
              </Toolbar>
            </TitleBar>
          </div>
          <div>
            <div style={caption}>utility, {state}</div>
            <TitleBar variant="utility" title="Help" controls={<WindowControls size="small" />} />
          </div>
        </div>
      ))}
    </div>
  );
}
