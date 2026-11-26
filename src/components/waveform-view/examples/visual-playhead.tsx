import { WaveformView, WaveformViewDetail } from "macalicious/waveform-view";

/**
 * Visual comparison target: the playhead alone, the 10 pt of the Voice Memos window from 390 to
 * 400 pt and the first 259 pt of the detailed view: both dots and the line between them, above
 * the ruler's labels. The recording is empty, so no bar and no tick stands in the crop.
 *
 * Reference crop (2x pixels) x=892 y=210 w=20 h=518, the same in both captures.
 */
export default function VisualPlayhead() {
  return (
    <div style={{ position: "relative", width: 10, height: 259, overflow: "hidden" }}>
      <WaveformView
        samples={[]}
        duration={0}
        style={{ position: "absolute", left: -390, width: 789 }}
      >
        <WaveformViewDetail />
      </WaveformView>
    </div>
  );
}
