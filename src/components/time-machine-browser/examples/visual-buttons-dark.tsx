import { VisualScreen } from "./visual-screen";

/**
 * Visual comparison target: Cancel and the disabled Restore in Dark Aqua, 246 x 42 pt.
 * Reference crop (2x pixels) x=1428 y=1632 w=492 h=84 of the dark Time Machine capture.
 */
export default function VisualButtonsDark() {
  return (
    <VisualScreen
      dark
      flat
      crop={[714, 816, 246, 42]}
      backdrop="linear-gradient(to right, #27354a, #2c3746 50%, #2d3b4d)"
    />
  );
}
