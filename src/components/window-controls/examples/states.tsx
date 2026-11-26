import { WindowControls } from "macalicious/window-controls";

const cell = { display: "grid", gap: 6, justifyItems: "start" } as const;
const caption = {
  font: "var(--mac-font-label)",
  color: "var(--mac-color-label-secondary)",
} as const;

/**
 * The states side by side. Hover is transient, so this gallery pins it with the `data-force`
 * preview attribute; pressed and keyboard focus are not shown here.
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
        <span style={caption}>Key window</span>
        <WindowControls aria-label="Window controls, key" />
      </div>
      <div style={cell}>
        <span style={caption}>Pointer over the group</span>
        <WindowControls aria-label="Window controls, hover" data-force="hover" />
      </div>
      <div style={cell}>
        <span style={caption}>Zoom roles (hover)</span>
        <div style={{ display: "flex", gap: 12 }}>
          <WindowControls aria-label="Window controls, zoom" data-force="hover" zoomRole="zoom" />
          <WindowControls
            aria-label="Window controls, exit full screen"
            data-force="hover"
            zoomRole="exit-full-screen"
            minimizeDisabled
          />
        </div>
      </div>
      <div style={cell}>
        <span style={caption}>Edited document</span>
        <WindowControls aria-label="Window controls, edited" edited />
      </div>
      <div style={cell}>
        <span style={caption}>Zoom disabled</span>
        <WindowControls aria-label="Window controls, zoom disabled" zoomDisabled />
      </div>
      <div style={cell} data-window-state="main">
        <span style={caption}>Main window</span>
        <WindowControls aria-label="Window controls, main" />
      </div>
      <div
        style={{ ...cell, background: "var(--mac-material-titlebar-inactive)" }}
        data-window-state="inactive"
      >
        <span style={caption}>Inactive window</span>
        <WindowControls aria-label="Window controls, inactive" />
      </div>
      <div style={cell} data-accent="graphite">
        <span style={caption}>Graphite accent</span>
        <WindowControls aria-label="Window controls, graphite" />
      </div>
      <div style={cell}>
        <span style={caption}>Small (utility panel)</span>
        <WindowControls aria-label="Window controls, small" size="small" />
      </div>
    </div>
  );
}
