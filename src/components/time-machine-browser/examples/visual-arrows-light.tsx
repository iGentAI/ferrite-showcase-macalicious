import { VisualScreen } from "./visual-screen";

/**
 * Visual comparison target: the two arrows and the date in Aqua, 130 x 120 pt. Reference crop
 * (2x pixels) x=2660 y=1044 w=260 h=240 of the light Time Machine capture.
 */
export default function VisualArrowsLight() {
  return (
    <VisualScreen flat crop={[1330, 522, 130, 120]} backdrop="linear-gradient(#4e6d87, #45647f)" />
  );
}
