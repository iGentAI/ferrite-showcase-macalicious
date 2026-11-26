import { RadioButton, RadioGroup } from "macalicious/radio-button";

const cell = { display: "grid", gap: 8, justifyItems: "start", alignContent: "start" } as const;
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
      style={{ display: "grid", gridTemplateColumns: "repeat(3, max-content)", gap: "20px 32px" }}
    >
      <div style={cell}>
        <span style={caption}>Normal</span>
        <RadioGroup defaultValue="on" aria-label="Normal">
          <RadioButton value="off">Off</RadioButton>
          <RadioButton value="on">On</RadioButton>
          <RadioButton value="mixed" mixed>
            Mixed
          </RadioButton>
        </RadioGroup>
      </div>
      <div style={cell}>
        <span style={caption}>Pressed</span>
        <RadioGroup defaultValue="on" aria-label="Pressed">
          <RadioButton value="off" data-force="pressed">
            Off
          </RadioButton>
          <RadioButton value="on" data-force="pressed">
            On
          </RadioButton>
        </RadioGroup>
      </div>
      <div style={cell}>
        <span style={caption}>Keyboard focus</span>
        <RadioGroup defaultValue="on" aria-label="Keyboard focus">
          <RadioButton value="off" data-force="focus">
            Off
          </RadioButton>
          <RadioButton value="on" data-force="focus">
            On
          </RadioButton>
        </RadioGroup>
      </div>
      <div style={cell}>
        <span style={caption}>Disabled</span>
        <RadioGroup disabled defaultValue="on" aria-label="Disabled">
          <RadioButton value="off">Off</RadioButton>
          <RadioButton value="on">On</RadioButton>
        </RadioGroup>
      </div>
      <div style={cell} data-window-state="main">
        <span style={caption}>Main window, not key</span>
        <RadioGroup defaultValue="on" aria-label="Main window">
          <RadioButton value="off">Off</RadioButton>
          <RadioButton value="on">On</RadioButton>
        </RadioGroup>
      </div>
      <div style={cell} data-window-state="inactive">
        <span style={caption}>Inactive window</span>
        <RadioGroup defaultValue="on" aria-label="Inactive window">
          <RadioButton value="off">Off</RadioButton>
          <RadioButton value="on">On</RadioButton>
        </RadioGroup>
      </div>
    </div>
  );
}
