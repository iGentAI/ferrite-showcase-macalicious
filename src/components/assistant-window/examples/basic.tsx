import {
  AssistantWindow,
  AssistantWindowActions,
  AssistantWindowHeading,
  AssistantWindowText,
} from "macalicious/assistant-window";
import { PushButton } from "macalicious/push-button";

/** Stand-in artwork: Boot Camp's diamonds are Apple's and are not part of the library. */
function Artwork() {
  return (
    <svg
      width="175"
      height="326"
      viewBox="0 0 175 326"
      style={{ marginTop: 80 }}
      aria-hidden="true"
    >
      <path d="M60 20l70 70-70 70-70-70z" fill="#b9bcc2" />
      <path d="M60 150l70 70-70 70-70-70z" fill="#9a9ea6" />
    </svg>
  );
}

export default function Basic() {
  return (
    <AssistantWindow title="Setup Assistant" artwork={<Artwork />} width={620} height={380}>
      <AssistantWindowHeading id="assistant-basic-step">Introduction</AssistantWindowHeading>
      <AssistantWindowText aria-labelledby="assistant-basic-step">
        <p>This assistant prepares a second disk for your backups.</p>
        <p>
          It takes about ten minutes. You can leave at any step; nothing is changed until you click
          Erase on the last one.
        </p>
      </AssistantWindowText>
      <AssistantWindowActions leading={<PushButton>Open Help</PushButton>}>
        <PushButton>Continue</PushButton>
      </AssistantWindowActions>
    </AssistantWindow>
  );
}
