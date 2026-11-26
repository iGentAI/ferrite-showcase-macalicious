import { GradientButton, GradientButtonGroup } from "macalicious/gradient-button";

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
        <span style={caption}>Normal</span>
        <GradientButtonGroup>
          <GradientButton glyph="add" aria-label="Add" />
          <GradientButton glyph="remove" aria-label="Remove" />
          <GradientButton glyph="action" aria-label="Actions" />
        </GradientButtonGroup>
      </div>
      <div style={cell}>
        <span style={caption}>Pressed</span>
        <GradientButton glyph="add" aria-label="Add, pressed" data-force="pressed" />
      </div>
      <div style={cell}>
        <span style={caption}>On</span>
        <GradientButton glyph="add" aria-label="Add, on" aria-pressed />
      </div>
      <div style={cell}>
        <span style={caption}>Keyboard focus</span>
        <GradientButton glyph="add" aria-label="Add, focused" data-force="focus" />
      </div>
      <div style={cell}>
        <span style={caption}>Disabled</span>
        <GradientButtonGroup>
          <GradientButton glyph="add" aria-label="Add, disabled" disabled />
          <GradientButton glyph="remove" aria-label="Remove, disabled" disabled />
        </GradientButtonGroup>
      </div>
      <div style={cell} data-window-state="inactive">
        <span style={caption}>Inactive window</span>
        <GradientButtonGroup>
          <GradientButton glyph="add" aria-label="Add, inactive window" />
          <GradientButton glyph="remove" aria-label="Remove, inactive window" />
        </GradientButtonGroup>
      </div>
    </div>
  );
}
