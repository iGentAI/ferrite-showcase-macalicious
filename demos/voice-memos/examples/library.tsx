import { VoiceMemos } from "../voice-memos";

/**
 * The view behind Done: the recordings in a sidebar, with a search field above them and the
 * button that starts a new recording below, beside the player. Choose a recording to show it;
 * Edit in the toolbar opens it over the whole window. No reference screenshot shows this view.
 */
export default function Library() {
  return (
    <div
      style={{
        boxSizing: "border-box",
        width: "100%",
        overflowX: "auto",
        padding: "31px 48px 67px",
      }}
    >
      <VoiceMemos defaultView="library" width="100%" style={{ minWidth: 560, maxWidth: 789 }} />
    </div>
  );
}
