import { VoiceMemos } from "../voice-memos";

/**
 * Visual comparison target: the whole of 10-15-Catalina-Light-Voice-Memos.png, 1802 x 1484 px,
 * i.e. 901 x 742 pt: the 789 x 630 pt window at (56, 38) with its shadow around it, over the
 * white matte the comparison sets behind the capture's transparent margin.
 *
 * The capture shows the demo as it opens: "New Recording 3", 3.095 s long, with the playhead
 * at its end and the timer at 00:03.09.
 */
export default function VisualWindow() {
  return (
    <div style={{ width: 901, height: 742, background: "white", position: "relative" }}>
      <VoiceMemos style={{ position: "absolute", left: 56, top: 38 }} />
    </div>
  );
}
