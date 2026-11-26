import { VisualScreen } from "./visual-screen";

/**
 * Visual comparison target: the leading end of the stack in Aqua, 210 x 120 pt. Reference
 * crop (2x pixels) x=700 y=320 w=420 h=240 of the light Time Machine capture: eight windows
 * behind the front one, six with a title bar and two blank, over the blurred sky.
 */
export default function VisualStackLight() {
  return (
    <VisualScreen
      crop={[350, 160, 210, 120]}
      backdrop="linear-gradient(#5e94b4, #6c98b3 33%, #7399ae 66%, #71899a)"
    />
  );
}
