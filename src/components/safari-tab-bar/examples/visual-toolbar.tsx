import { SafariNewTabButton } from "macalicious/safari-tab-bar";
import { TitleBar } from "macalicious/title-bar";
import { Toolbar, ToolbarSpace } from "macalicious/toolbar";

/**
 * Visual comparison target: the new-tab cell on its own, at the trailing end of the toolbar of
 * a Safari window with one tab (the Favorites captures).
 *
 * Reference crop: the last 32 pt of the window's width, from 8 pt under its top edge to the
 * bottom of the 38 pt bar (32 x 30 pt). The bar is a title-hidden title bar whose trailing edge
 * is the crop's; the window's own edge, which covers the last point, is masked.
 */
export default function VisualToolbar() {
  return (
    <div style={{ position: "relative", width: 32, height: 30, overflow: "hidden" }}>
      <TitleBar
        variant="title-hidden"
        divider="content"
        style={{ position: "absolute", right: 0, top: -8, width: 240 }}
      >
        <Toolbar aria-label="Browser toolbar">
          <ToolbarSpace />
          <SafariNewTabButton />
        </Toolbar>
      </TitleBar>
    </div>
  );
}
