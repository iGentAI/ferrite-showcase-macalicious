import { MessageBubble, MessageStatus, MessageTranscript } from "macalicious/message-bubble";

export default function Services() {
  return (
    <MessageTranscript aria-label="Sent messages" style={{ width: 320 }}>
      <MessageBubble direction="sent" sender="You, by iMessage">
        Sent with iMessage
      </MessageBubble>
      <MessageStatus>Delivered</MessageStatus>
      <MessageBubble direction="sent" service="sms" sender="You, by text message">
        Sent as a text message
      </MessageBubble>
      <MessageBubble sender="Ada">Received, whatever the service</MessageBubble>
      <MessageBubble direction="sent" sender="You, by iMessage" sending>
        Still being sent
      </MessageBubble>
    </MessageTranscript>
  );
}
