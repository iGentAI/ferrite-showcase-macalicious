import { DefaultButton } from "macalicious/default-button";

const cell = { display: "grid", gap: 6, justifyItems: "start" } as const;
const caption = {
  font: "var(--mac-font-label)",
  color: "var(--mac-color-label-secondary)",
} as const;

/**
 * Every state side by side. Pressed and focused are transient, so this gallery pins them with
 * the `data-force` preview attribute; in an application they come from :active and
 * :focus-visible. None of these buttons is inside a window, dialog or form, so none answers
 * the Return key.
 */
export default function States() {
  return (
    <div
      style={{ display: "grid", gridTemplateColumns: "repeat(3, max-content)", gap: "16px 28px" }}
    >
      <div style={cell}>
        <span style={caption}>Normal</span>
        <DefaultButton>Button</DefaultButton>
      </div>
      <div style={cell}>
        <span style={caption}>Pressed</span>
        <DefaultButton data-force="pressed">Button</DefaultButton>
      </div>
      <div style={cell}>
        <span style={caption}>Keyboard focus</span>
        <DefaultButton data-force="focus">Button</DefaultButton>
      </div>
      <div style={cell}>
        <span style={caption}>Disabled</span>
        <DefaultButton disabled>Button</DefaultButton>
      </div>
      <div style={cell} data-window-state="main">
        <span style={caption}>Main window, not key</span>
        <DefaultButton>Button</DefaultButton>
      </div>
      <div style={cell} data-window-state="inactive">
        <span style={caption}>Inactive window</span>
        <DefaultButton>Button</DefaultButton>
      </div>
    </div>
  );
}
