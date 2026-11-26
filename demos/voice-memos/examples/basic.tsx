import { VoiceMemos } from "../voice-memos";

/**
 * Voice Memos as the reference screenshots show it: one recording, with the waveform, the
 * overview and the timer. Play it, skip, or drag the waveform or the red handle; Done shows
 * the list of recordings, and choosing one there shows it in the player. The window takes the
 * width the page gives it, up to the captured 789 pt; the margins leave room for its shadow.
 */
export default function Basic() {
  return (
    <div
      style={{
        boxSizing: "border-box",
        width: "100%",
        overflowX: "auto",
        padding: "31px 48px 67px",
      }}
    >
      <VoiceMemos width="100%" style={{ minWidth: 560, maxWidth: 789 }} />
    </div>
  );
}
