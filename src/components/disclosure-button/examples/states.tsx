import { DisclosureButton } from "macalicious/disclosure-button";

const cell = { display: "grid", gap: 6, justifyItems: "start" } as const;
const caption = {
  font: "var(--mac-font-label)",
  color: "var(--mac-color-label-secondary)",
} as const;

/**
 * Every state side by side. Pressed and focused are transient, so this gallery pins them with
 * the `data-force` preview attribute; in an application they come from :active and
 * :focus-visible.
 */
export default function States() {
  return (
    <div
      style={{ display: "grid", gridTemplateColumns: "repeat(3, max-content)", gap: "16px 28px" }}
    >
      <div style={cell}>
        <span style={caption}>Collapsed</span>
        <DisclosureButton aria-label="Details, collapsed" />
      </div>
      <div style={cell}>
        <span style={caption}>Expanded</span>
        <DisclosureButton aria-label="Details, expanded" defaultExpanded />
      </div>
      <div style={cell}>
        <span style={caption}>Pressed</span>
        <DisclosureButton aria-label="Details, pressed" data-force="pressed" />
      </div>
      <div style={cell}>
        <span style={caption}>Keyboard focus</span>
        <DisclosureButton aria-label="Details, focused" data-force="focus" />
      </div>
      <div style={cell}>
        <span style={caption}>Disabled</span>
        <DisclosureButton aria-label="Details, disabled" disabled />
      </div>
      <div style={cell} data-window-state="inactive">
        <span style={caption}>Inactive window</span>
        <DisclosureButton aria-label="Details, inactive window" />
      </div>
    </div>
  );
}
