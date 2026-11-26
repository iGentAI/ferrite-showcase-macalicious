import { VisualScreen } from "./visual-screen";

/**
 * Visual comparison target: Cancel and the disabled Restore in Aqua, 246 x 42 pt. Reference
 * crop (2x pixels) x=1428 y=1800 w=492 h=84 of the light Time Machine capture. The backdrop is
 * the blurred picture there: dark blue with a lighter glow between the buttons.
 */
export default function VisualButtonsLight() {
  return (
    <VisualScreen
      flat
      crop={[714, 900, 246, 42]}
      backdrop="radial-gradient(ellipse 45% 160% at 48% -10%, #3a4652, #2b3d50 55%, transparent), linear-gradient(to right, #213a52, #22374c)"
    />
  );
}
