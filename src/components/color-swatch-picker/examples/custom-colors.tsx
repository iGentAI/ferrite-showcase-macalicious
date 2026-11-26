import { ColorSwatch, ColorSwatchPicker } from "macalicious/color-swatch-picker";

const colors = [
  { value: "indigo", label: "Indigo", color: "#5856d6" },
  { value: "teal", label: "Teal", color: "#30b0c7" },
  { value: "mint", label: "Mint", color: "rgb(0 199 190)" },
  { value: "brown", label: "Brown", color: "#a2845e" },
];

/**
 * Swatches of any colour: `color` takes a CSS colour, and the edge is derived from it (darker
 * in Aqua, lighter in Dark Aqua). The accessible name is the colour's name, not its value.
 */
export default function CustomColors() {
  return (
    <ColorSwatchPicker aria-label="Label color" defaultValue="teal">
      {colors.map(({ value, label, color }) => (
        <ColorSwatch key={value} value={value} color={color} aria-label={label} />
      ))}
    </ColorSwatchPicker>
  );
}
