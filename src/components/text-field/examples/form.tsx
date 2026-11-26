import { Label } from "macalicious/label";
import { TextField } from "macalicious/text-field";

/**
 * A form row as in System Preferences > Sharing: a right-aligned label ending 8 pt before the
 * field, on the field's baseline, and helper text 9 pt under the field.
 */
export default function Form() {
  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "max-content 1fr",
        columnGap: "var(--mac-space-label-gap)",
        rowGap: 9,
        alignItems: "baseline",
        width: 420,
      }}
    >
      {/* biome-ignore lint/a11y/noLabelWithoutControl: the label names the input through htmlFor */}
      <Label render={<label htmlFor="text-field-form-name" />} align="end">
        Computer Name:
      </Label>
      <TextField id="text-field-form-name" defaultValue="ismh15" style={{ width: "100%" }} />
      <span />
      <Label textStyle="small">
        Computers on your local network can access your computer at: ismh15.local
      </Label>
    </div>
  );
}
