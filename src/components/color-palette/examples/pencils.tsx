import { ColorPalette, CRAYON_COLORS } from "macalicious/color-palette";

export default function Pencils() {
  return (
    <ColorPalette
      aria-label="Pencils"
      variant="pencils"
      colors={CRAYON_COLORS}
      defaultValue="#ff9300"
    />
  );
}
