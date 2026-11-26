import { ActivityMonitor } from "../activity-monitor";
import { EMPTY_SAMPLE } from "../activity-monitor-data";

/** The small rise at the trailing end of the capture's CPU graph. */
const HISTORY = [EMPTY_SAMPLE, { ...EMPTY_SAMPLE, cpu: [4.8, 4.9] as const }, EMPTY_SAMPLE];

/**
 * Visual comparison target: the whole Activity Monitor window of the light capture, with its
 * first row selected and the updates paused.
 * Reference crop (2x pixels) x=112 y=76 w=1678 h=1268, i.e. the 839 x 634 pt frame, over the
 * capture's transparent margin (matte white).
 */
export default function VisualWindow() {
  return (
    <div
      style={{
        position: "relative",
        overflow: "hidden",
        width: 839,
        height: 634,
        background: "#ffffff",
      }}
    >
      <ActivityMonitor
        defaultUpdateInterval={0}
        defaultSelectedPid={2026}
        history={HISTORY}
        style={{ position: "absolute", inset: 0 }}
      />
    </div>
  );
}
