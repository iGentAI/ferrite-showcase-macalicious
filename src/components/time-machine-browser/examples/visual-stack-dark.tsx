import { VisualScreen } from "./visual-screen";

/**
 * Visual comparison target: the leading end of the stack in Dark Aqua, 210 x 120 pt.
 * Reference crop (2x pixels) x=880 y=486 w=420 h=240 of the dark Time Machine capture, where
 * the oldest backup is shown and all eight windows behind it are blank.
 */
export default function VisualStackDark() {
  return (
    <VisualScreen
      dark
      crop={[440, 243, 210, 120]}
      backdrop="linear-gradient(to right, #335076, #2e4259 55%)"
    />
  );
}
