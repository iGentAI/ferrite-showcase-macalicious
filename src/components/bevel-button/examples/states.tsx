import { BevelButton } from "macalicious/bevel-button";

const cell = { display: "grid", gap: 6, justifyItems: "start" } as const;
const caption = {
  font: "var(--mac-font-label)",
  color: "var(--mac-color-label-secondary)",
} as const;

function Dot() {
  return (
    <svg viewBox="0 0 12 12" width="12" height="12" aria-hidden="true" focusable="false">
      <circle cx="6" cy="6" r="5" fill="currentColor" />
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
      style={{ display: "grid", gridTemplateColumns: "repeat(4, max-content)", gap: "16px 28px" }}
    >
      <div style={cell}>
        <span style={caption}>Off</span>
        <BevelButton aria-label="Off">
          <Dot />
        </BevelButton>
      </div>
      <div style={cell}>
        <span style={caption}>On</span>
        <BevelButton aria-label="On" defaultPressed>
          <Dot />
        </BevelButton>
      </div>
      <div style={cell}>
        <span style={caption}>Pressed</span>
        <BevelButton aria-label="Pressed" data-force="pressed">
          <Dot />
        </BevelButton>
      </div>
      <div style={cell}>
        <span style={caption}>Keyboard focus</span>
        <BevelButton aria-label="Focused" data-force="focus">
          <Dot />
        </BevelButton>
      </div>
      <div style={cell}>
        <span style={caption}>Disabled</span>
        <BevelButton aria-label="Disabled" disabled>
          <Dot />
        </BevelButton>
      </div>
      <div style={cell}>
        <span style={caption}>Rounded</span>
        <BevelButton aria-label="Rounded" variant="rounded">
          <Dot />
        </BevelButton>
      </div>
      <div style={cell}>
        <span style={caption}>Image and title</span>
        <BevelButton>
          <Dot />
          Record
        </BevelButton>
      </div>
      <div style={cell} data-window-state="inactive">
        <span style={caption}>Inactive window</span>
        <BevelButton aria-label="On, inactive window" defaultPressed>
          <Dot />
        </BevelButton>
      </div>
    </div>
  );
}
