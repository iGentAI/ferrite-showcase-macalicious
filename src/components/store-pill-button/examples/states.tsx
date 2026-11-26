import { StorePillButton } from "macalicious/store-pill-button";

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
        <StorePillButton>Get</StorePillButton>
        <StorePillButton variant="filled">Install</StorePillButton>
      </div>
      <div style={cell}>
        <span style={caption}>Pressed</span>
        <StorePillButton data-force="pressed">Get</StorePillButton>
        <StorePillButton variant="filled" data-force="pressed">
          Install
        </StorePillButton>
      </div>
      <div style={cell}>
        <span style={caption}>Keyboard focus</span>
        <StorePillButton data-force="focus">Get</StorePillButton>
        <StorePillButton variant="filled" data-force="focus">
          Install
        </StorePillButton>
      </div>
      <div style={cell}>
        <span style={caption}>Disabled</span>
        <StorePillButton disabled>Get</StorePillButton>
        <StorePillButton variant="filled" disabled>
          Install
        </StorePillButton>
      </div>
      <div style={cell} data-window-state="inactive">
        <span style={caption}>Window not key</span>
        <StorePillButton>Get</StorePillButton>
        <StorePillButton variant="filled">Install</StorePillButton>
      </div>
      <div style={cell}>
        <span style={caption}>Downloading</span>
        <StorePillButton progress={0.4}>Stop</StorePillButton>
        <StorePillButton progress={0.4} disabled>
          Stop
        </StorePillButton>
      </div>
    </div>
  );
}
