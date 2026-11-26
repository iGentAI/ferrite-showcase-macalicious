import { WaveformView, WaveformViewDetail, WaveformViewOverview } from "macalicious/waveform-view";
import { useState } from "react";

// A made-up amplitude envelope, 20 samples a second for twelve seconds.
const SAMPLES = Array.from({ length: 240 }, (_, i) => {
  const phrase = Math.sin((i / 60) * Math.PI) ** 2;
  return 0.03 + 0.45 * phrase * Math.abs(Math.sin(i * 0.7));
});

/**
 * The position is owned by the application, which would also move it during playback. The
 * time under the views follows a drag of the waveform, a drag of the handle and the keyboard.
 */
export default function Controlled() {
  const [position, setPosition] = useState(4.5);
  return (
    <WaveformView
      samples={SAMPLES}
      duration={12}
      value={position}
      onValueChange={setPosition}
      aria-label="Interview"
      style={{ width: 480, paddingBottom: 12 }}
    >
      <WaveformViewDetail aria-label="Waveform of Interview" />
      <WaveformViewOverview style={{ margin: "24px 20px 0" }} />
      <output style={{ display: "block", textAlign: "center", color: "#ffffff" }}>
        {position.toFixed(2)} s
      </output>
    </WaveformView>
  );
}
