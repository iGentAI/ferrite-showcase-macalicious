import {
  Alert,
  AlertAccessory,
  AlertButtons,
  AlertClose,
  AlertInformativeText,
  AlertMessage,
  AlertPopup,
  AlertTrigger,
} from "macalicious/alert";
import { Checkbox } from "macalicious/checkbox";
import { DefaultButton } from "macalicious/default-button";
import { PushButton } from "macalicious/push-button";

/** A stand-in for a disk icon: Apple's artwork is not part of the library. */
function Icon() {
  return (
    <svg viewBox="0 0 64 64" width="64" height="64" aria-hidden="true">
      <rect x="6" y="16" width="52" height="32" rx="6" fill="var(--mac-color-system-gray)" />
      <circle cx="48" cy="40" r="3" fill="var(--mac-color-system-green)" />
    </svg>
  );
}

/**
 * A critical alert: the icon is badged with a caution triangle, the destructive answer is not
 * the default button, and a suppression checkbox sits under the text.
 */
export default function Critical() {
  return (
    <Alert>
      <AlertTrigger render={<PushButton />}>Erase Disk…</AlertTrigger>
      <AlertPopup icon={<Icon />} alertStyle="critical">
        <AlertMessage>Are you sure you want to erase “Backup”?</AlertMessage>
        <AlertInformativeText>
          Erasing a disk deletes everything stored on it. You can’t undo this action.
        </AlertInformativeText>
        <AlertAccessory>
          <Checkbox size="small">Do not show this message again</Checkbox>
        </AlertAccessory>
        <AlertButtons>
          <AlertClose>Erase</AlertClose>
          <AlertClose render={<DefaultButton />}>Cancel</AlertClose>
        </AlertButtons>
      </AlertPopup>
    </Alert>
  );
}
