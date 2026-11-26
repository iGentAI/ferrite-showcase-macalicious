import { RoundButton } from "macalicious/round-button";

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
        <RoundButton aria-label="Information">i</RoundButton>
      </div>
      <div style={cell}>
        <span style={caption}>Pressed</span>
        <RoundButton aria-label="Information, pressed" data-force="pressed">
          i
        </RoundButton>
      </div>
      <div style={cell}>
        <span style={caption}>Keyboard focus</span>
        <RoundButton aria-label="Information, focused" data-force="focus">
          i
        </RoundButton>
      </div>
      <div style={cell}>
        <span style={caption}>Disabled</span>
        <RoundButton aria-label="Information, disabled" disabled>
          i
        </RoundButton>
      </div>
      <div style={cell} data-window-state="inactive">
        <span style={caption}>Inactive window</span>
        <RoundButton aria-label="Information, inactive window">i</RoundButton>
      </div>
    </div>
  );
}
