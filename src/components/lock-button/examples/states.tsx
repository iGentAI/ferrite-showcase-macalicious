import { LockButton } from "macalicious/lock-button";

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
      style={{ display: "grid", gridTemplateColumns: "repeat(2, max-content)", gap: "16px 28px" }}
    >
      <div style={cell}>
        <span style={caption}>Locked</span>
        <LockButton />
      </div>
      <div style={cell}>
        <span style={caption}>Unlocked</span>
        <LockButton state="unlocked" />
      </div>
      <div style={cell}>
        <span style={caption}>Authenticating</span>
        <LockButton state="authenticating" />
      </div>
      <div style={cell}>
        <span style={caption}>Disabled</span>
        <LockButton disabled />
      </div>
      <div style={cell}>
        <span style={caption}>Pressed</span>
        <LockButton data-force="pressed" />
      </div>
      <div style={cell}>
        <span style={caption}>Keyboard focus</span>
        <LockButton data-force="focus" />
      </div>
      <div style={cell}>
        <span style={caption}>Small, locked and unlocked</span>
        <span style={{ display: "flex", gap: 12 }}>
          <LockButton size="small" />
          <LockButton size="small" state="unlocked" />
        </span>
      </div>
      <div style={cell} data-window-state="inactive">
        <span style={caption}>Inactive window</span>
        <LockButton />
      </div>
    </div>
  );
}
