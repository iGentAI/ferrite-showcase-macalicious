import { DisclosureTriangle } from "macalicious/disclosure-triangle";

const cell = { display: "grid", gap: 6, justifyItems: "start" } as const;
const caption = {
  font: "var(--mac-font-label)",
  color: "var(--mac-color-label-secondary)",
} as const;

/**
 * Every state side by side. Pressed and focused are transient, so this gallery pins them with
 * the `data-force` preview attribute; in an application they come from :active and
 * :focus-visible. The last cell is a selected, emphasised row, which sets the triangle's colour
 * hook to its own text colour.
 */
export default function States() {
  return (
    <div
      style={{ display: "grid", gridTemplateColumns: "repeat(3, max-content)", gap: "16px 28px" }}
    >
      <div style={cell}>
        <span style={caption}>Collapsed</span>
        <DisclosureTriangle aria-label="Details, collapsed" />
      </div>
      <div style={cell}>
        <span style={caption}>Expanded</span>
        <DisclosureTriangle aria-label="Details, expanded" defaultExpanded />
      </div>
      <div style={cell}>
        <span style={caption}>Pressed</span>
        <DisclosureTriangle aria-label="Details, pressed" data-force="pressed" />
      </div>
      <div style={cell}>
        <span style={caption}>Keyboard focus</span>
        <DisclosureTriangle aria-label="Details, focused" data-force="focus" />
      </div>
      <div style={cell}>
        <span style={caption}>Disabled</span>
        <DisclosureTriangle aria-label="Details, disabled" disabled />
      </div>
      <div style={cell}>
        <span style={caption}>In a selected row</span>
        <span
          style={
            {
              display: "flex",
              padding: "3px 24px 3px 6px",
              background: "var(--mac-color-selected-content-background)",
              "--mac-disclosure-triangle-color": "var(--mac-color-selected-content-text)",
            } as React.CSSProperties
          }
        >
          <DisclosureTriangle aria-label="Details, in a selected row" />
        </span>
      </div>
    </div>
  );
}
