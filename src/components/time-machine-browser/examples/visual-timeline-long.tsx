import { type TimeMachineBackup, TimeMachineBrowser } from "macalicious/time-machine-browser";
import type { CSSProperties } from "react";

const BACKUPS: TimeMachineBackup[] = Array.from({ length: 60 }, (_, n) => ({
  value: `backup-${n}`,
  label: `Backup ${n + 1}`,
}));

/**
 * Visual check target: sixty backups on a timeline with room for fifteen, 200 x 300 pt on a
 * plain backdrop. The newest backup is shown at first, at the lower end; Home moves to the
 * oldest, which the timeline brings into view at its upper end. No screenshot shows it.
 */
export default function VisualTimelineLong() {
  return (
    <div style={{ width: 200, height: 300, background: "#102030" }}>
      <TimeMachineBrowser
        backups={BACKUPS}
        stack={0}
        style={{ "--mac-time-machine-browser-backdrop": "none" } as CSSProperties}
      />
    </div>
  );
}
