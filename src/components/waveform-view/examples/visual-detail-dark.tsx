import { WaveformView, WaveformViewDetail } from "macalicious/waveform-view";

// A stand-in envelope: the screenshots do not hold the recording's samples, so the comparisons
// mask the bars.
const SAMPLES = Array.from({ length: 57 }, (_, i) =>
  i < 14 || i > 50 ? 0.03 : 0.12 + 0.3 * Math.abs(Math.sin(i * 1.3)),
);

/**
 * Visual comparison target: the detailed waveform in the Dark Aqua capture, whose recording is
 * 3.065 s long, so its ruler stands 3 pt further right than in the Aqua capture.
 *
 * Reference crop (2x pixels) x=112 y=210 w=1578 h=560, as for `visual-detail`.
 */
export default function VisualDetailDark() {
  return (
    <WaveformView samples={SAMPLES} duration={3.065} value={3.065} style={{ width: 789 }}>
      <WaveformViewDetail />
    </WaveformView>
  );
}
