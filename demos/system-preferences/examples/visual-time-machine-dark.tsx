import { SystemPreferences } from "../system-preferences";

/**
 * Visual comparison target: the Time Machine pane in Dark Aqua, 668 x 440 pt: idle, with the
 * dates of the backups in place of the progress bar and less space available, as in
 * Dark-System-Preferences-Time-Machine.
 *
 * Reference crop x=112 y=76 w=1336 h=880: the opaque frame without its shadow.
 */
export default function VisualTimeMachineDark() {
  return (
    <div
      style={{
        position: "relative",
        width: 668,
        height: 440,
        overflow: "hidden",
        background: "white",
      }}
    >
      <SystemPreferences
        style={{ position: "absolute" }}
        defaultPane="time-machine"
        defaultSettings={{ "time-machine.backingUp": false, "time-machine.available": "41.3 GB" }}
      />
    </div>
  );
}
