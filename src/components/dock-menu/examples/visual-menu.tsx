import { DockMenu, DockMenuPopup, DockMenuTrigger } from "macalicious/dock-menu";
import { MenuItem } from "macalicious/menu-item";
import { useState } from "react";

/**
 * Fixture for a Dock menu, which no screenshot shows. The menu's body is compared with the
 * nearest thing the screenshots have, the dark detached menu of the Contacts screenshot (crop
 * 1136,420 of 384 x 154 px, captured from the 192 x 77 pt area at the top): a 179 pt menu at
 * 6,6 over that window's background, above a 48 pt stand-in Dock item. The pointer (12 x 6 pt
 * at 89.5,71) and the menu being dark in Aqua are checked as pixels.
 */
export default function VisualMenu() {
  const [stage, setStage] = useState<HTMLDivElement | null>(null);
  return (
    <div
      ref={setStage}
      style={{
        position: "relative",
        width: 192,
        height: 135,
        background: "light-dark(#ffffff, #1e1f20)",
      }}
    >
      <div data-testid="area" style={{ position: "absolute", inset: "0 0 auto", height: 77 }} />
      <DockMenu defaultOpen modal={false}>
        <DockMenuTrigger
          aria-label="Contacts"
          style={{
            position: "absolute",
            left: 71.5,
            top: 81,
            width: 48,
            height: 48,
            padding: 0,
            border: 0,
            borderRadius: 11,
            background: "var(--mac-color-system-yellow)",
          }}
        />
        <DockMenuPopup container={stage} collisionPadding={0} style={{ width: 179 }}>
          {/* The key equivalent must not show: a Dock menu hides them. */}
          <MenuItem keyEquivalent="command+e">Send Email</MenuItem>
          <MenuItem data-testid="message">Send Message</MenuItem>
          <MenuItem>Search with Spotlight</MenuItem>
        </DockMenuPopup>
      </DockMenu>
    </div>
  );
}
