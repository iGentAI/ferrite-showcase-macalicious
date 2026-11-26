import { VoiceMemos } from "../voice-memos";

/**
 * Visual check target for what no reference screenshot shows: the window alone, 789 x 630 pt,
 * opened on the list of recordings. The checks press its buttons with real input and read the
 * colours of chosen pixels.
 */
export default function VisualLibrary() {
  return (
    <div style={{ width: 789, height: 630, position: "relative" }}>
      <VoiceMemos defaultView="library" style={{ position: "absolute", left: 0, top: 0 }} />
    </div>
  );
}
