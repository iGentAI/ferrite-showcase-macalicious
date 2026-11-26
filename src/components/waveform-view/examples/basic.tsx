import { WaveformView, WaveformViewDetail, WaveformViewOverview } from "macalicious/waveform-view";

// A made-up amplitude envelope, 20 samples a second for seven seconds.
const SAMPLES = Array.from({ length: 140 }, (_, i) => {
  const swell = Math.sin((i / 140) * Math.PI) ** 2;
  return 0.04 + 0.5 * swell * Math.abs(Math.sin(i * 0.9) * Math.cos(i * 0.23));
});

export default function Basic() {
  return (
    <WaveformView
      samples={SAMPLES}
      duration={7}
      defaultValue={3}
      aria-label="New Recording"
      style={{ width: 480 }}
    >
      <WaveformViewDetail />
      <WaveformViewOverview style={{ margin: "24px 20px 0" }} />
    </WaveformView>
  );
}
