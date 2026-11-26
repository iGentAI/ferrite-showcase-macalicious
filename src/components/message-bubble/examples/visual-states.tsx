import { MessageBubble, MessageTranscript } from "macalicious/message-bubble";

/**
 * Fixture for what no screenshot shows: a received bubble without a tail, a green text-message
 * bubble with one, and a blue bubble without. 300 x 99 pt: the bubbles are 24 pt tall at y 10,
 * 42 and 67; the received one starts at x 17 and the sent ones end at x 283.
 */
export default function VisualStates() {
  return (
    <MessageTranscript aria-label="States" style={{ width: 300 }}>
      <MessageBubble tail={false}>No tail</MessageBubble>
      <MessageBubble direction="sent" service="sms">
        Text message
      </MessageBubble>
      <MessageBubble direction="sent" tail={false}>
        No tail
      </MessageBubble>
    </MessageTranscript>
  );
}
