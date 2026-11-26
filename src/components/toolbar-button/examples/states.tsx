import { SystemImage } from "macalicious/system-image";
import { ToolbarButton } from "macalicious/toolbar-button";

const cell = { display: "grid", gap: 6, justifyItems: "start" } as const;
const caption = {
  font: "var(--mac-font-label)",
  color: "var(--mac-color-label-secondary)",
} as const;

/**
 * Every state side by side. Pressed and keyboard focus are transient, so this gallery pins
 * them with the `data-force` preview attribute.
 */
export default function States() {
  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "repeat(4, max-content)",
        gap: "16px 28px",
        padding: 12,
        background: "var(--mac-material-titlebar)",
      }}
    >
      <div style={cell}>
        <span style={caption}>Normal</span>
        <ToolbarButton aria-label="Sidebar">
          <SystemImage name="sidebar" />
        </ToolbarButton>
      </div>
      <div style={cell}>
        <span style={caption}>Pressed</span>
        <ToolbarButton aria-label="Sidebar" data-force="pressed">
          <SystemImage name="sidebar" />
        </ToolbarButton>
      </div>
      <div style={cell}>
        <span style={caption}>Keyboard focus</span>
        <ToolbarButton aria-label="Sidebar" data-force="focus">
          <SystemImage name="sidebar" />
        </ToolbarButton>
      </div>
      <div style={cell}>
        <span style={caption}>Disabled</span>
        <ToolbarButton aria-label="Sidebar" disabled>
          <SystemImage name="sidebar" />
        </ToolbarButton>
      </div>
      <div style={cell}>
        <span style={caption}>Toggle, on</span>
        <ToolbarButton aria-label="Sidebar" defaultPressed>
          <SystemImage name="sidebar" />
        </ToolbarButton>
      </div>
      <div style={cell}>
        <span style={caption}>Title</span>
        <ToolbarButton>Done</ToolbarButton>
      </div>
      <div style={cell} data-window-state="main">
        <span style={caption}>Main window</span>
        <ToolbarButton aria-label="Sidebar">
          <SystemImage name="sidebar" />
        </ToolbarButton>
      </div>
      <div
        style={{ ...cell, background: "var(--mac-material-titlebar-inactive)" }}
        data-window-state="inactive"
      >
        <span style={caption}>Inactive window</span>
        <ToolbarButton aria-label="Sidebar">
          <SystemImage name="sidebar" />
        </ToolbarButton>
      </div>
    </div>
  );
}
