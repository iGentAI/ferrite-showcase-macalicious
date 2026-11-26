import { WaveformView, WaveformViewOverview } from "macalicious/waveform-view";

// A stand-in envelope: the screenshots do not hold the recording's samples, so the comparisons
// mask the bars.
const SAMPLES = Array.from({ length: 57 }, (_, i) =>
  i < 14 || i > 50 ? 0.03 : 0.12 + 0.3 * Math.abs(Math.sin(i * 1.3)),
);

/**
 * Visual comparison target: the overview of Voice Memos with the handle at the end of a
 * recording of 3.095 s (Aqua capture), where the strip stands for more time than was recorded.
 *
 * Reference crop (2x pixels) x=178 y=860 w=1446 h=136, that is 723 x 68 pt: 2.15 pt above the
 * strip for the handle, the 44.1 pt strip and the two labels.
 */
export default function VisualOverview() {
  return (
    <WaveformView samples={SAMPLES} duration={3.095} value={3.095} style={{ width: 723 }}>
      <WaveformViewOverview span={19.92} />
    </WaveformView>
  );
}
