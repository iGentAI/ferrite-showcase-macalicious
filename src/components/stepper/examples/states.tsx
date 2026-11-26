import { Stepper } from "macalicious/stepper";

const cell = { display: "grid", gap: 6, justifyItems: "start", alignContent: "start" } as const;
const caption = {
  font: "var(--mac-font-label)",
  color: "var(--mac-color-label-secondary)",
} as const;

/**
 * Every state side by side. A pressed half and keyboard focus are transient, so this gallery
 * pins them with the `data-force` preview attribute; in an application they come from :active
 * and :focus-visible.
 */
export default function States() {
  return (
    <div
      style={{ display: "grid", gridTemplateColumns: "repeat(4, max-content)", gap: "16px 28px" }}
    >
      <div style={cell}>
        <span style={caption}>Normal</span>
        <Stepper aria-label="Normal" />
      </div>
      <div style={cell}>
        <span style={caption}>Upper half pressed</span>
        <Stepper aria-label="Upper half pressed" data-force="pressed-increment" />
      </div>
      <div style={cell}>
        <span style={caption}>Lower half pressed</span>
        <Stepper aria-label="Lower half pressed" data-force="pressed-decrement" />
      </div>
      <div style={cell}>
        <span style={caption}>Keyboard focus</span>
        <Stepper aria-label="Keyboard focus" data-force="focus" />
      </div>
      <div style={cell}>
        <span style={caption}>Disabled</span>
        <Stepper aria-label="Disabled" disabled />
      </div>
      <div style={cell} data-window-state="main">
        <span style={caption}>Main window, not key</span>
        <Stepper aria-label="Main window, focused" data-force="focus" />
      </div>
      <div style={cell} data-window-state="inactive">
        <span style={caption}>Inactive window</span>
        <Stepper aria-label="Inactive window, focused" data-force="focus" />
      </div>
      <div style={cell} data-window-state="inactive">
        <span style={caption}>Inactive, half pressed</span>
        <Stepper aria-label="Inactive window, upper half pressed" data-force="pressed-increment" />
      </div>
    </div>
  );
}
