import { Label } from "macalicious/label";

/**
 * Right-aligned form labels end with a colon and sit 8 pt before their control. `render` turns
 * the label into a real `<label>` that names the control.
 */
export default function FormLabels() {
  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "max-content 180px",
        gap: "10px var(--mac-space-label-gap)",
        alignItems: "baseline",
      }}
    >
      {/* biome-ignore lint/a11y/noLabelWithoutControl: the label names the input through htmlFor */}
      <Label align="end" render={<label htmlFor="form-labels-name" />}>
        Computer Name:
      </Label>
      <input id="form-labels-name" defaultValue="Castle" />

      <Label align="end">Status:</Label>
      <Label textStyle="emphasized">Connected</Label>

      <Label textStyle="small-emphasized" color="tertiary" align="end">
        Location:
      </Label>
      <Label textStyle="small" selectable>
        Castle
      </Label>
    </div>
  );
}
