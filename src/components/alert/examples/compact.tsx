import {
  Alert,
  AlertButtons,
  AlertClose,
  AlertMessage,
  AlertPopup,
  AlertTrigger,
} from "macalicious/alert";
import { PushButton } from "macalicious/push-button";
import { WindowControls } from "macalicious/window-controls";

/** A stand-in for a document icon: Apple's artwork is not part of the library. */
function Icon() {
  return (
    <svg viewBox="0 0 32 32" width="32" height="32" aria-hidden="true">
      <path
        d="M8 3h11l6 6v20H8z"
        fill="var(--mac-color-control-background)"
        stroke="var(--mac-color-system-gray)"
      />
    </svg>
  );
}

/**
 * The compact alert Finder shows for a copy conflict: no title bar, window controls with close
 * and zoom disabled, 11 pt text and three small buttons, none of them the default.
 */
export default function Compact() {
  return (
    <Alert>
      <AlertTrigger render={<PushButton />}>Move…</AlertTrigger>
      <AlertPopup
        size="small"
        alertStyle="critical"
        icon={<Icon />}
        controls={<WindowControls closeDisabled zoomDisabled />}
      >
        <AlertMessage>
          An item named “Notes.txt” already exists in this location. Do you want to replace it with
          the one you’re moving?
        </AlertMessage>
        <AlertButtons>
          <AlertClose>Keep Both</AlertClose>
          <AlertClose>Stop</AlertClose>
          <AlertClose>Replace</AlertClose>
        </AlertButtons>
      </AlertPopup>
    </Alert>
  );
}
