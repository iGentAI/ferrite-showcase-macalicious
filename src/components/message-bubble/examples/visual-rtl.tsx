import { MessageBubble, MessageTranscript } from "macalicious/message-bubble";

/**
 * Fixture for a right-to-left transcript: the sides swap, and the tails with them. 300 x 74 pt:
 * the sent bubble is 24 pt tall at y 10 and starts at x 17, the received one is at y 42 and
 * ends at x 283; each tail reaches 4.7 pt beyond that edge at the bubble's bottom.
 */
export default function VisualRtl() {
  return (
    <MessageTranscript aria-label="Right to left" dir="rtl" style={{ width: 300 }}>
      <MessageBubble direction="sent">Sent</MessageBubble>
      <MessageBubble>Received</MessageBubble>
    </MessageTranscript>
  );
}
