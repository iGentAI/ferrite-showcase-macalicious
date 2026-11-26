import { VisualScreen } from "./visual-screen";

/**
 * Visual comparison target: the lower end of the timeline in Dark Aqua, 100 x 200 pt.
 * Reference crop (2x pixels) x=3160 y=1698 w=200 h=400 of the dark Time Machine capture: the
 * end of yesterday's backups, the mark of today, two backups and Now.
 */
export default function VisualTimelineDark() {
  return (
    <VisualScreen
      dark
      crop={[1580, 849, 100, 200]}
      backdrop="linear-gradient(#26374d, #253447 37.5%, #243343 62.5%, #243241 75%)"
    />
  );
}
