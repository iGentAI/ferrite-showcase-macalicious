import { VisualScreen } from "./visual-screen";

/**
 * Visual comparison target: the two arrows and the date in Dark Aqua, 150 x 120 pt. Reference
 * crop (2x pixels) x=2472 y=1044 w=300 h=240 of the dark Time Machine capture, where the
 * oldest backup is shown and the up arrow is disabled.
 */
export default function VisualArrowsDark() {
  return (
    <VisualScreen
      dark
      flat
      crop={[1236, 522, 150, 120]}
      backdrop="linear-gradient(#344d6d, #324a69 33%, #314560 60%, #2e4059)"
    />
  );
}
