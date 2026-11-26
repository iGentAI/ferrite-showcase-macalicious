import { LevelIndicator } from "macalicious/level-indicator";

/**
 * Visual comparison target: the trailing, empty end of the capacity bar in Disk Utility.
 * Reference crop (2x pixels) x=1778 y=484 w=120 h=68, i.e. 60 x 34 pt: the 600 x 24 pt bar
 * ends 55 pt from the crop's left edge and starts 5 pt from its top.
 */
export default function VisualDiskUtilityEnd() {
  return (
    <div
      style={{
        position: "relative",
        overflow: "hidden",
        width: 60,
        height: 34,
        background: "light-dark(#ececec, #303132)",
      }}
    >
      <LevelIndicator
        variant="storage"
        value={46}
        max={600}
        aria-label="Used space"
        style={{ position: "absolute", left: -545, top: 5, width: 600 }}
      />
    </div>
  );
}
