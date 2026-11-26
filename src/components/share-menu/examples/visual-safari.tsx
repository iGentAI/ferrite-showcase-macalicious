import { ShareMenu, ShareMenuItem } from "macalicious/share-menu";
import { useState } from "react";

/* Stand-ins for the services' icons, which are Safari's glyphs and application icons and are
   not reproduced: a 15 pt glyph for the first two rows, a 16 pt icon for the others. The
   comparison masks them. */
const glyph = (
  <svg viewBox="0 0 16 15" width="16" height="15" aria-hidden="true" focusable="false">
    <rect x="1.5" y="3.5" width="13" height="8" rx="2" fill="none" stroke="currentColor" />
  </svg>
);
const icon = (
  <svg viewBox="0 0 16 16" width="16" height="16" aria-hidden="true" focusable="false">
    <rect x="1" y="1" width="14" height="14" rx="3.5" fill="currentColor" opacity="0.5" />
  </svg>
);

/**
 * Visual comparison target: the Share menu of Safari with Messages highlighted (Safari-v13-
 * Sharing screenshots), 182 x 186 pt. The stage is the menu's rectangle; the menu hangs from a
 * Share button placed just above it, outside the capture. Behind the menu the screenshot has
 * the web page for 115 pt and the desktop picture for the last 67 pt: the stage paints two
 * gradients as stand-ins for what the material makes of them.
 */
export default function VisualSafari() {
  const [stage, setStage] = useState<HTMLDivElement | null>(null);
  return (
    <div
      ref={setStage}
      style={{
        position: "relative",
        width: 182,
        height: 186,
        overflow: "hidden",
        background: [
          "linear-gradient(light-dark(#2c2e40, #292926), light-dark(#005d78, #006571)) left / 115px 100% no-repeat",
          "linear-gradient(light-dark(#87c1ff, #000817), light-dark(#acd5ff, #001b44)) right / 67px 100% no-repeat",
        ].join(", "),
      }}
    >
      <ShareMenu
        defaultOpen
        modal={false}
        onMore={() => {}}
        style={{ position: "absolute", left: 0, top: -25 }}
        popupProps={{ container: stage, collisionPadding: 0, style: { width: 182 } }}
      >
        <ShareMenuItem image={glyph}>Add to Reading List</ShareMenuItem>
        <ShareMenuItem image={glyph}>Add Bookmark</ShareMenuItem>
        <ShareMenuItem image={icon}>Email This Page</ShareMenuItem>
        <ShareMenuItem image={icon} data-testid="messages">
          Messages
        </ShareMenuItem>
        <ShareMenuItem image={icon}>AirDrop</ShareMenuItem>
        <ShareMenuItem image={icon}>Notes</ShareMenuItem>
        <ShareMenuItem image={icon}>Reminders</ShareMenuItem>
      </ShareMenu>
    </div>
  );
}
