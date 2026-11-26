import { VoiceMemos } from "../voice-memos";

/**
 * Visual comparison target: the whole of 10-15-Catalina-Dark-Voice-Memos.png, 1802 x 1484 px,
 * i.e. 901 x 742 pt, laid out as `visual-window`.
 *
 * The Dark Aqua capture shows another recording: "New Recording 4", 3.065 s long, so its
 * timer reads 00:03.06, its ruler stands 3 pt further right and the overview's handle 2 pt
 * further left.
 */
export default function VisualWindowDark() {
  return (
    <div style={{ width: 901, height: 742, background: "white", position: "relative" }}>
      <VoiceMemos
        defaultRecordingId="new-recording-4"
        style={{ position: "absolute", left: 56, top: 38 }}
      />
    </div>
  );
}
