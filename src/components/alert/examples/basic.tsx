import {
  Alert,
  AlertButtons,
  AlertClose,
  AlertInformativeText,
  AlertMessage,
  AlertPopup,
  AlertTrigger,
} from "macalicious/alert";
import { DefaultButton } from "macalicious/default-button";
import { PushButton } from "macalicious/push-button";

/** A stand-in for the application icon: Apple's artwork is not part of the library. */
function Icon() {
  return (
    <svg viewBox="0 0 64 64" width="64" height="64" aria-hidden="true">
      <rect x="6" y="6" width="52" height="52" rx="12" fill="var(--mac-color-system-gray)" />
      <path
        d="M22 24h20M25 24l1.500 20h11l1.500-20M28 20h8"
        fill="none"
        stroke="white"
        strokeWidth="3"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export default function Basic() {
  return (
    <Alert>
      <AlertTrigger render={<PushButton />}>Empty Trash…</AlertTrigger>
      <AlertPopup icon={<Icon />}>
        <AlertMessage>
          Are you sure you want to permanently erase the items in the Trash?
        </AlertMessage>
        <AlertInformativeText>You can’t undo this action.</AlertInformativeText>
        <AlertButtons>
          <AlertClose>Cancel</AlertClose>
          <AlertClose render={<DefaultButton />}>Empty Trash</AlertClose>
        </AlertButtons>
      </AlertPopup>
    </Alert>
  );
}
