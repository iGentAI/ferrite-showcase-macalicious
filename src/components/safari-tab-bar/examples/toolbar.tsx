import { SafariNewTabButton } from "macalicious/safari-tab-bar";
import { TitleBar } from "macalicious/title-bar";
import { Toolbar, ToolbarSpace } from "macalicious/toolbar";
import { ToolbarButton } from "macalicious/toolbar-button";
import { WindowControls } from "macalicious/window-controls";

/**
 * A window with one tab shows no tab bar: its new-tab cell is the last item of the toolbar,
 * in the toolbar's lower corner against the window's edge.
 */
export default function InToolbar() {
  return (
    <TitleBar variant="title-hidden" controls={<WindowControls />} style={{ width: 460 }}>
      <Toolbar aria-label="Browser toolbar">
        <ToolbarSpace />
        <ToolbarButton>Share</ToolbarButton>
        <SafariNewTabButton />
      </Toolbar>
    </TitleBar>
  );
}
