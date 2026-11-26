import { PushButton } from "macalicious/push-button";
import { ShareMenu, ShareMenuItem } from "macalicious/share-menu";

const icon = (color: string) => (
  <svg viewBox="0 0 16 16" width="16" height="16" aria-hidden="true" focusable="false">
    <rect x="1" y="1" width="14" height="14" rx="3.5" fill={color} />
  </svg>
);

/** Another control as the trigger, a disabled service, and no More… item. */
export default function CustomTrigger() {
  return (
    <ShareMenu trigger={<PushButton>Share…</PushButton>} popupProps={{ sideOffset: 0 }}>
      <ShareMenuItem image={icon("#4a9df8")}>Mail</ShareMenuItem>
      <ShareMenuItem image={icon("#5bd35b")}>Messages</ShareMenuItem>
      <ShareMenuItem image={icon("#9aa3ad")} disabled>
        AirDrop
      </ShareMenuItem>
    </ShareMenu>
  );
}
