import { ColorPalette } from "macalicious/color-palette";

/** A palette of your own: any list of names and `#rrggbb` values. */
export default function CustomColors() {
  return (
    <ColorPalette
      aria-label="Brand colors"
      defaultValue="#0071e3"
      colors={[
        ["Ink", "#1d1d1f"],
        ["Paper", "#f5f5f7"],
        ["Link", "#0071e3"],
        ["Warning", "#bf4800"],
      ]}
    />
  );
}
