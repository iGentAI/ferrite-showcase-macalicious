import { SystemPreferences } from "../system-preferences";

/**
 * Visual comparison target: the Sound pane in Dark Aqua, 668 x 499 pt: as the Aqua capture,
 * but with Mute on, as in Dark-System-Preferences-Sound.
 *
 * Reference crop x=112 y=76 w=1336 h=998: the opaque frame without its shadow.
 */
export default function VisualSoundDark() {
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
      <SystemPreferences
        style={{ position: "absolute" }}
        defaultPane="sound"
        defaultSettings={{ "sound.mute": true }}
      />
    </div>
  );
}
