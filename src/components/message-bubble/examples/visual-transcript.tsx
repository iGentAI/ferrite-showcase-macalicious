import {
  MessageBubble,
  MessageStatus,
  MessageTranscript,
  MessageTranscriptHeader,
} from "macalicious/message-bubble";

/**
 * Visual comparison target: the transcript of the Aqua Messages screenshot.
 *
 * Reference crop (2x pixels) x=1300 y=230 w=900 h=250, that is 450 x 125 pt of the 459 pt wide
 * transcript, whose top-left corner is at 1288,214: the crop starts 6 pt in and 8 pt down. The
 * sent bubble is the 261.75 x 40 pt body at 180,42 of the transcript, the status ends at 446 and
 * the received bubble is the 154 x 24 pt body at 17,103.
 *
 * The recipient's name is blurred out of the screenshot; a blank of its width keeps
 * "iMessage with" where the screenshot has it. The received bubble is given its measured width
 * and kept on one line, because off Apple platforms the text is set in the fallback font and
 * is a little wider.
 */
export default function VisualTranscript() {
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
          Today, 3:26 PM
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
