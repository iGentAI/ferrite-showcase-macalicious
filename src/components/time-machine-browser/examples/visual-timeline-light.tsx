import { VisualScreen } from "./visual-screen";

/**
 * Visual comparison target: the lower end of the timeline in Aqua, 100 x 200 pt. Reference
 * crop (2x pixels) x=3160 y=1698 w=200 h=400 of the light Time Machine capture: dim ticks, the
 * mark of today, six backups, the one shown in red, and Now.
 */
export default function VisualTimelineLight() {
  return (
    <VisualScreen
      crop={[1580, 849, 100, 200]}
      backdrop="linear-gradient(#2a4b69, #28445d 37.5%, #273f57 62.5%, #283e55 75%, #273c52)"
    />
  );
}
