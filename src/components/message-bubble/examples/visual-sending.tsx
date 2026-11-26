import { MessageBubble, MessageTranscript } from "macalicious/message-bubble";

/**
 * Fixture for a message that is still being sent, which no screenshot shows: one sent bubble.
 * 300 x 42 pt: the bubble is 24 pt tall at y 10 and ends at x 283, with 10.3 pt of padding
 * after its text.
 */
export default function VisualSending() {
  return (
    <MessageTranscript aria-label="Sending" style={{ width: 300 }}>
      <MessageBubble direction="sent" tail={false} sending>
        On its way
      </MessageBubble>
    </MessageTranscript>
  );
}
