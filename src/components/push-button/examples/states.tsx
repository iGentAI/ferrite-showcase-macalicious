import { PushButton } from "macalicious/push-button";

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
        <PushButton>Button</PushButton>
        <PushButton variant="primary">Button</PushButton>
      </div>
      <div style={cell}>
        <span style={caption}>Pressed</span>
        <PushButton data-force="pressed">Button</PushButton>
        <PushButton variant="primary" data-force="pressed">
          Button
        </PushButton>
      </div>
      <div style={cell}>
        <span style={caption}>Keyboard focus</span>
        <PushButton data-force="focus">Button</PushButton>
        <PushButton variant="primary" data-force="focus">
          Button
        </PushButton>
      </div>
      <div style={cell}>
        <span style={caption}>Disabled</span>
        <PushButton disabled>Button</PushButton>
        <PushButton variant="primary" disabled>
          Button
        </PushButton>
      </div>
      <div style={cell} data-window-state="main">
        <span style={caption}>Main window, not key</span>
        <PushButton>Button</PushButton>
        <PushButton variant="primary">Button</PushButton>
        <PushButton variant="emphasized">Done</PushButton>
      </div>
      <div style={cell} data-window-state="inactive">
        <span style={caption}>Inactive window</span>
        <PushButton>Button</PushButton>
        <PushButton variant="primary">Button</PushButton>
        <PushButton variant="emphasized">Done</PushButton>
      </div>
    </div>
  );
}
