import { MessageBubble, MessageTranscript } from "macalicious/message-bubble";

export default function Basic() {
  return (
    <MessageTranscript aria-label="Conversation with Ada" style={{ width: 320 }}>
      <MessageBubble direction="sent" sender="You">
        Can you believe another year has gone by?!
      </MessageBubble>
      <MessageBubble sender="Ada">New macOS, who dis?</MessageBubble>
    </MessageTranscript>
  );
}
