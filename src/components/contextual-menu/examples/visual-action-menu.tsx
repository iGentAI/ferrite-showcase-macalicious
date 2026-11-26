import {
  ContextualMenu,
  ContextualMenuPopup,
  ContextualMenuTrigger,
} from "macalicious/contextual-menu";
import { MenuItem } from "macalicious/menu-item";
import { useEffect, useRef } from "react";

/**
 * The detached action menu of the Contacts screenshot (Dark Aqua), the closest sighting of a
 * contextual menu: crop 1136,420 of 384 x 154 px, a 179 pt menu at 6,6 over the window's
 * content background. The example opens the menu as a secondary click at 5,5 does, so the
 * menu's corner is 1 pt right of and below the pointer. The comparison hovers "Send Message".
 */
export default function VisualActionMenu() {
  const area = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const element = area.current;
    if (!element) return;
    const box = element.getBoundingClientRect();
    element.dispatchEvent(
      new MouseEvent("contextmenu", {
        bubbles: true,
        cancelable: true,
        button: 2,
        clientX: box.left + 5,
        clientY: box.top + 5,
      }),
    );
  }, []);
  return (
    <ContextualMenu>
      <ContextualMenuTrigger
        ref={area}
        style={{ width: 192, height: 77, background: "light-dark(#ffffff, #1e1f20)" }}
      />
      <ContextualMenuPopup collisionPadding={0} style={{ width: 179 }}>
        {/* The key equivalent must not show: a contextual menu hides them. */}
        <MenuItem keyEquivalent="command+e">Send Email</MenuItem>
        <MenuItem data-testid="message">Send Message</MenuItem>
        <MenuItem>Search with Spotlight</MenuItem>
      </ContextualMenuPopup>
    </ContextualMenu>
  );
}
