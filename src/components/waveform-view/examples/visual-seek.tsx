import { WaveformView, WaveformViewOverview } from "macalicious/waveform-view";

/**
 * Fixture for what no screenshot shows: seeking from the keyboard. A recording of ten seconds
 * in a strip 200 pt wide, with the handle at the middle; the comparison focuses the slider and
 * presses Home, which takes the handle to the strip's start.
 */
export default function VisualSeek() {
  return (
    <WaveformView samples={[]} duration={10} defaultValue={5} style={{ width: 200 }}>
      <WaveformViewOverview />
    </WaveformView>
  );
}
