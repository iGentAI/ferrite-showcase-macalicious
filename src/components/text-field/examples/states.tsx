import { TextField } from "macalicious/text-field";

const cell = { display: "grid", gap: 6, justifyItems: "start" } as const;
const caption = {
  font: "var(--mac-font-label)",
  color: "var(--mac-color-label-secondary)",
} as const;

/**
 * Every state side by side. Focus is transient, so this gallery pins it with the `data-force`
 * preview attribute; in an application it comes from the keyboard focus.
 */
export default function States() {
  return (
    <div
      style={{ display: "grid", gridTemplateColumns: "repeat(3, max-content)", gap: "16px 28px" }}
    >
      <div style={cell}>
        <span style={caption}>Text</span>
        <TextField aria-label="Text" defaultValue="ismh15" />
      </div>
      <div style={cell}>
        <span style={caption}>Placeholder</span>
        <TextField aria-label="Placeholder" placeholder="Optional" />
      </div>
      <div style={cell}>
        <span style={caption}>Focused</span>
        <TextField aria-label="Focused" defaultValue="ismh15" data-force="focus" />
      </div>
      <div style={cell}>
        <span style={caption}>Disabled</span>
        <TextField aria-label="Disabled" defaultValue="ismh15" disabled />
      </div>
      <div style={cell}>
        <span style={caption}>Read-only</span>
        <TextField aria-label="Read-only" defaultValue="ismh15" readOnly />
      </div>
      <div style={cell} data-window-state="inactive">
        <span style={caption}>Inactive window, focused</span>
        <TextField aria-label="Inactive window" defaultValue="ismh15" data-force="focus" />
      </div>
    </div>
  );
}
