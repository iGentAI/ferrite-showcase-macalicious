import { WaveformView, WaveformViewDetail } from "macalicious/waveform-view";

// A stand-in envelope: the screenshots do not hold the recording's samples, so the comparisons
// mask the bars. 57 samples for 3.09 s, about one for each bar.
const SAMPLES = Array.from({ length: 57 }, (_, i) =>
  i < 14 || i > 50 ? 0.03 : 0.12 + 0.3 * Math.abs(Math.sin(i * 1.3)),
);

/**
 * Visual comparison target: the detailed waveform of Voice Memos with the playhead at the end
 * of a recording of 3.095 s (Aqua capture).
 *
 * Reference crop (2x pixels) x=112 y=210 w=1578 h=560, that is the window's 789 pt by 280 pt:
 * 7.6 pt above the panel for the playhead's dot, the 243.5 pt panel and 28.9 pt of ruler.
 */
export default function VisualDetail() {
  return (
    <WaveformView samples={SAMPLES} duration={3.095} value={3.095} style={{ width: 789 }}>
      <WaveformViewDetail />
    </WaveformView>
  );
}
