import { ToolbarSearchField } from "macalicious/toolbar-search-field";

const cell = { display: "grid", gap: 6, justifyItems: "start" } as const;
const caption = {
  font: "var(--mac-font-label)",
  color: "var(--mac-color-label-secondary)",
} as const;

/** Every state side by side. Focus is transient, so this gallery pins it with `data-force`. */
export default function States() {
  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "repeat(3, max-content)",
        gap: "16px 28px",
        padding: 12,
        background: "var(--mac-material-titlebar)",
      }}
    >
      <div style={cell}>
        <span style={caption}>Empty</span>
        <ToolbarSearchField aria-label="Search, empty" />
      </div>
      <div style={cell}>
        <span style={caption}>With text</span>
        <ToolbarSearchField aria-label="Search, with text" defaultValue="Aqua" />
      </div>
      <div style={cell}>
        <span style={caption}>Focused</span>
        <ToolbarSearchField aria-label="Search, focused" defaultValue="Aqua" data-force="focus" />
      </div>
      <div style={cell}>
        <span style={caption}>Disabled</span>
        <ToolbarSearchField aria-label="Search, disabled" disabled />
      </div>
      <div style={cell} data-window-state="main">
        <span style={caption}>Main window</span>
        <ToolbarSearchField aria-label="Search, main window" />
      </div>
      <div
        style={{ ...cell, background: "var(--mac-material-titlebar-inactive)" }}
        data-window-state="inactive"
      >
        <span style={caption}>Inactive window</span>
        <ToolbarSearchField aria-label="Search, inactive window" />
      </div>
    </div>
  );
}
