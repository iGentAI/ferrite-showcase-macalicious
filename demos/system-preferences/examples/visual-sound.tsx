import { SystemPreferences } from "../system-preferences";

/**
 * Visual comparison target: the Sound pane in Aqua, 668 x 499 pt, Sound Effects tab, Funk
 * selected, Mute off, as in Light-System-Preferences-Sound.
 *
 * Reference crop x=112 y=76 w=1336 h=998: the opaque frame without its shadow.
 */
export default function VisualSound() {
  return (
    <div
      style={{
        position: "relative",
        width: 668,
        height: 499,
        overflow: "hidden",
        background: "white",
      }}
    >
      <SystemPreferences style={{ position: "absolute" }} defaultPane="sound" />
    </div>
  );
}
