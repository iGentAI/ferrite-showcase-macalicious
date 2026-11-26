import { ComboBox, ComboBoxItem, ComboBoxSeparator } from "macalicious/combo-box";
import { Label } from "macalicious/label";

/**
 * A combo box in a form row: a label in title case that ends with a colon names the field,
 * and the field starts with a value from the list. A separator sets the recent entries apart.
 */
export default function Labelled() {
  return (
    <div style={{ display: "flex", alignItems: "baseline", gap: "var(--mac-space-label-gap)" }}>
      {/* biome-ignore lint/a11y/noLabelWithoutControl: the label names the input through htmlFor */}
      <Label render={<label htmlFor="labelled-folder" />}>Go to the folder:</Label>
      <ComboBox id="labelled-folder" defaultValue="~/Documents/" style={{ width: 220 }}>
        <ComboBoxItem>~/Documents/</ComboBoxItem>
        <ComboBoxItem>~/Downloads/</ComboBoxItem>
        <ComboBoxItem>~/Library/</ComboBoxItem>
        <ComboBoxSeparator />
        <ComboBoxItem>/usr/local/bin/</ComboBoxItem>
      </ComboBox>
    </div>
  );
}
