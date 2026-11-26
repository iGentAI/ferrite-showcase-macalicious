import { Stickies } from "../stickies";

/**
 * Visual comparison target: the left end of the menu bar of the Aqua Stickies screenshot.
 *
 * Reference crop (2x pixels) x=0 y=0 w=800 h=46, that is 400 x 23 pt: the 22 pt bar, its
 * shadow line over the sky, the mark of the Apple menu (a stand-in here) and the titles
 * Stickies, File, Edit, Font, Color, Window and Help. In the Dark Aqua capture Finder is
 * frontmost and the bar shows Finder's menus, so only Aqua is compared.
 */
export default function VisualMenuBar() {
  return (
    <div style={{ position: "relative", width: 400, height: 23, overflow: "hidden" }}>
      <Stickies style={{ position: "absolute", left: 0, top: 0, width: 1680, height: 1050 }} />
    </div>
  );
}
