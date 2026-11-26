import { Slider } from "macalicious/slider";

const cell = { display: "grid", gap: 6, alignContent: "start", width: 120 } as const;
const caption = {
  font: "var(--mac-font-label)",
  color: "var(--mac-color-label-secondary)",
} as const;

/**
 * Every state side by side, without and with tick marks. Pressed and focused are transient,
 * so this gallery pins them with the `data-force` preview attribute; in an application they
 * come from dragging the thumb and from :focus-visible.
 */
export default function States() {
  return (
    <div
      style={{ display: "grid", gridTemplateColumns: "repeat(3, max-content)", gap: "16px 28px" }}
    >
      <div style={cell}>
        <span style={caption}>Normal</span>
        <Slider aria-label="Normal" defaultValue={50} />
        <Slider aria-label="Normal, tick marks" tickMarks={5} defaultValue={50} />
      </div>
      <div style={cell}>
        <span style={caption}>Pressed</span>
        <Slider aria-label="Pressed" defaultValue={50} data-force="pressed" />
        <Slider
          aria-label="Pressed, tick marks"
          tickMarks={5}
          defaultValue={50}
          data-force="pressed"
        />
      </div>
      <div style={cell}>
        <span style={caption}>Keyboard focus</span>
        <Slider aria-label="Focused" defaultValue={50} data-force="focus" />
        <Slider
          aria-label="Focused, tick marks"
          tickMarks={5}
          defaultValue={50}
          data-force="focus"
        />
      </div>
      <div style={cell}>
        <span style={caption}>Disabled</span>
        <Slider aria-label="Disabled" defaultValue={50} disabled />
        <Slider aria-label="Disabled, tick marks" tickMarks={5} defaultValue={50} disabled />
      </div>
      <div style={cell} data-window-state="main">
        <span style={caption}>Main window, not key</span>
        <Slider aria-label="Main window" defaultValue={50} />
        <Slider aria-label="Main window, tick marks" tickMarks={5} defaultValue={50} />
      </div>
      <div style={cell} data-window-state="inactive">
        <span style={caption}>Inactive window</span>
        <Slider aria-label="Inactive window" defaultValue={50} />
        <Slider aria-label="Inactive window, tick marks" tickMarks={5} defaultValue={50} />
      </div>
    </div>
  );
}
