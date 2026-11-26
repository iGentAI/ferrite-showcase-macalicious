import {
  MessageBubble,
  MessageStatus,
  MessageTranscript,
  MessageTranscriptHeader,
} from "macalicious/message-bubble";

export default function Conversation() {
  return (
    <MessageTranscript aria-label="Conversation with Ada Appleseed" style={{ width: 380 }}>
      <MessageTranscriptHeader title="iMessage with Ada Appleseed">
        Today, 3:26 PM
      </MessageTranscriptHeader>
      <MessageBubble sender="Ada" tail={false}>
        Are you coming on Friday?
      </MessageBubble>
      <MessageBubble sender="Ada">We booked the long table by the window.</MessageBubble>
      <MessageBubble direction="sent" sender="You" tail={false}>
        Yes!
      </MessageBubble>
      <MessageBubble direction="sent" sender="You">
        Can you believe another year has gone by?!
      </MessageBubble>
      <MessageStatus>Delivered</MessageStatus>
    </MessageTranscript>
  );
}
