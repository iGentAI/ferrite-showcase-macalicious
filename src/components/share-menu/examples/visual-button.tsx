import { ShareMenu, ShareMenuItem } from "macalicious/share-menu";
import { TitleBar } from "macalicious/title-bar";

/**
 * Visual comparison target: the Share button of Safari while its menu is open (Safari-v13-
 * Sharing screenshots), 50 x 30 pt of the toolbar from 1 pt below the window's top edge: the
 * 37 x 22 pt bezel 5.5 pt in and 7 pt down, on the title bar's material.
 *
 * Reference crops (2x pixels): Aqua x=2274 y=37 w=100 h=60, Dark Aqua x=2292 y=21 w=100 h=60.
 * The stage ends above the menu, which hangs 3 pt below the button, outside the stage. The
 * glyph is the library's drawing, not Safari's, and is masked.
 */
export default function VisualButton() {
  return (
    <div style={{ position: "relative", width: 50, height: 30 }}>
      <div style={{ position: "absolute", inset: 0, overflow: "hidden" }}>
        <TitleBar
          variant="title-hidden"
          style={{ position: "absolute", top: -1, left: -40, right: -40, height: 38 }}
        />
      </div>
      <ShareMenu
        defaultOpen
        modal={false}
        style={{ position: "absolute", left: 5.5, top: 7, width: 37 }}
        popupProps={{ style: { width: 182 } }}
      >
        <ShareMenuItem>Messages</ShareMenuItem>
      </ShareMenu>
    </div>
  );
}
