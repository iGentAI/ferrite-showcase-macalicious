import { ImageButton } from "macalicious/image-button";

const cell = { display: "grid", gap: 6, justifyItems: "start" } as const;
const caption = {
  font: "var(--mac-font-label)",
  color: "var(--mac-color-label-secondary)",
} as const;

function Icon() {
  return (
    <svg viewBox="0 0 32 32" width="32" height="32" aria-hidden="true" focusable="false">
      <rect x="1" y="1" width="30" height="30" rx="5" fill="#6aa6d8" />
    </svg>
  );
}

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
        <ImageButton label="General">
          <Icon />
        </ImageButton>
      </div>
      <div style={cell}>
        <span style={caption}>Pressed</span>
        <ImageButton label="General" data-force="pressed">
          <Icon />
        </ImageButton>
      </div>
      <div style={cell}>
        <span style={caption}>Keyboard focus</span>
        <ImageButton label="General" data-force="focus">
          <Icon />
        </ImageButton>
      </div>
      <div style={cell}>
        <span style={caption}>Disabled</span>
        <ImageButton label="General" disabled>
          <Icon />
        </ImageButton>
      </div>
      <div style={cell}>
        <span style={caption}>Image only</span>
        <ImageButton aria-label="General">
          <Icon />
        </ImageButton>
      </div>
      <div style={cell} data-window-state="inactive">
        <span style={caption}>Inactive window</span>
        <ImageButton label="General">
          <Icon />
        </ImageButton>
      </div>
    </div>
  );
}
