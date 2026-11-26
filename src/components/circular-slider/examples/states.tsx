import { CircularSlider } from "macalicious/circular-slider";

const cell = { display: "grid", gap: 6, justifyItems: "start" } as const;
const caption = {
  font: "var(--mac-font-label)",
  color: "var(--mac-color-label-secondary)",
} as const;

/**
 * Every state side by side, without and with tick marks. Pressed and focused are transient,
 * so this gallery pins them with the `data-force` preview attribute; in an application they
 * come from :active and :focus-visible.
 */
export default function States() {
  return (
    <div
      style={{ display: "grid", gridTemplateColumns: "repeat(3, max-content)", gap: "16px 28px" }}
    >
      <div style={cell}>
        <span style={caption}>Normal</span>
        <CircularSlider aria-label="Normal" defaultValue={25} />
        <CircularSlider aria-label="Normal, tick marks" tickMarks={8} defaultValue={25} />
      </div>
      <div style={cell}>
        <span style={caption}>Pressed</span>
        <CircularSlider aria-label="Pressed" defaultValue={25} data-force="pressed" />
        <CircularSlider
          aria-label="Pressed, tick marks"
          tickMarks={8}
          defaultValue={25}
          data-force="pressed"
        />
      </div>
      <div style={cell}>
        <span style={caption}>Keyboard focus</span>
        <CircularSlider aria-label="Focused" defaultValue={25} data-force="focus" />
        <CircularSlider
          aria-label="Focused, tick marks"
          tickMarks={8}
          defaultValue={25}
          data-force="focus"
        />
      </div>
      <div style={cell}>
        <span style={caption}>Disabled</span>
        <CircularSlider aria-label="Disabled" defaultValue={25} disabled />
        <CircularSlider
          aria-label="Disabled, tick marks"
          tickMarks={8}
          defaultValue={25}
          disabled
        />
      </div>
      <div style={cell} data-window-state="main">
        <span style={caption}>Main window, not key</span>
        <CircularSlider aria-label="Main window" defaultValue={25} />
        <CircularSlider aria-label="Main window, tick marks" tickMarks={8} defaultValue={25} />
      </div>
      <div style={cell} data-window-state="inactive">
        <span style={caption}>Inactive window</span>
        <CircularSlider aria-label="Inactive window" defaultValue={25} />
        <CircularSlider aria-label="Inactive window, tick marks" tickMarks={8} defaultValue={25} />
      </div>
    </div>
  );
}
