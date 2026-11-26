import { ShareMenu, ShareMenuItem } from "macalicious/share-menu";

/* Stand-in icons drawn for this example: the services' real icons are their applications'. */
const icon = (color: string) => (
  <svg viewBox="0 0 16 16" width="16" height="16" aria-hidden="true" focusable="false">
    <rect x="1" y="1" width="14" height="14" rx="3.5" fill={color} />
  </svg>
);

export default function Basic() {
  return (
    <ShareMenu onMore={() => {}}>
      <ShareMenuItem image={icon("#4a9df8")}>Mail</ShareMenuItem>
      <ShareMenuItem image={icon("#5bd35b")}>Messages</ShareMenuItem>
      <ShareMenuItem image={icon("#9aa3ad")}>AirDrop</ShareMenuItem>
      <ShareMenuItem image={icon("#f5c842")}>Notes</ShareMenuItem>
    </ShareMenu>
  );
}
