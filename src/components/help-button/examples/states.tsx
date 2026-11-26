import { HelpButton } from "macalicious/help-button";

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
      style={{ display: "grid", gridTemplateColumns: "repeat(5, max-content)", gap: "16px 28px" }}
    >
      <div style={cell}>
        <span style={caption}>Normal</span>
        <HelpButton />
      </div>
      <div style={cell}>
        <span style={caption}>Pressed</span>
        <HelpButton label="Help, pressed" data-force="pressed" />
      </div>
      <div style={cell}>
        <span style={caption}>Keyboard focus</span>
        <HelpButton label="Help, focused" data-force="focus" />
      </div>
      <div style={cell}>
        <span style={caption}>Disabled</span>
        <HelpButton label="Help, disabled" disabled />
      </div>
      <div style={cell} data-window-state="inactive">
        <span style={caption}>Inactive window</span>
        <HelpButton label="Help, inactive window" />
      </div>
    </div>
  );
}
