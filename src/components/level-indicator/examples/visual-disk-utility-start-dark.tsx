import { LevelIndicator } from "macalicious/level-indicator";

/**
 * Visual comparison target: the leading end of the capacity bar in Disk Utility's Dark Aqua
 * capture, whose volume is less full than the Aqua one. Reference crop (2x pixels) x=678 y=484
 * w=240 h=68, i.e. 120 x 34 pt: the 600 x 24 pt bar starts 5 pt from the left and from the
 * top, and its used part is 32 pt wide.
 */
export default function VisualDiskUtilityStartDark() {
  return (
    <div
      style={{
        position: "relative",
        overflow: "hidden",
        width: 120,
        height: 34,
        background: "light-dark(#ececec, #303132)",
      }}
    >
      <LevelIndicator
        variant="storage"
        value={32}
        max={600}
        aria-label="Used space"
        style={{ position: "absolute", left: 5, top: 5, width: 600 }}
      />
    </div>
  );
}
