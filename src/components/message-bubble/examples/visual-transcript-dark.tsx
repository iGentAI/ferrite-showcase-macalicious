import {
  MessageBubble,
  MessageStatus,
  MessageTranscript,
  MessageTranscriptHeader,
} from "macalicious/message-bubble";

/**
 * Visual comparison target: the transcript of the Dark Aqua Messages screenshot. It is
 * visual-transcript with the time the dark capture shows, "Yesterday, 3:26 PM".
 *
 * Reference crop (2x pixels) x=1312 y=222 w=900 h=250: the dark window sits 12 px to the right
 * of and 8 px above the light one, so this is the same 450 x 125 pt of the transcript, whose
 * top-left corner is at 1300,206. (The spec's crop for this screenshot, 1310,220, is the same
 * region one point up and to the left.)
 */
export default function VisualTranscriptDark() {
  return (
    <div style={{ width: 450, height: 125, overflow: "hidden" }}>
      <MessageTranscript
        aria-label="Conversation"
        style={{ width: 459, height: 135, margin: "-8px 0 0 -6px" }}
      >
        <MessageTranscriptHeader
          title={
            <>
              iMessage with
              <span style={{ display: "inline-block", width: 108 }} />
            </>
          }
        >
          Yesterday, 3:26 PM
        </MessageTranscriptHeader>
        <MessageBubble direction="sent">Can you believe another year has gone by?!</MessageBubble>
        <MessageStatus>Delivered</MessageStatus>
        <MessageBubble style={{ width: 154, whiteSpace: "nowrap" }}>
          New macOS, who dis?
        </MessageBubble>
      </MessageTranscript>
    </div>
  );
}
