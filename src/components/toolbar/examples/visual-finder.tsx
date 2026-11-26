import { SystemImage } from "macalicious/system-image";
import { TitleBar } from "macalicious/title-bar";
import { Toolbar, ToolbarSpace } from "macalicious/toolbar";
import { ToolbarButton } from "macalicious/toolbar-button";
import { ToolbarSearchField } from "macalicious/toolbar-search-field";
import { ToolbarSegment, ToolbarSegmentedControl } from "macalicious/toolbar-segmented-control";
import { Window } from "macalicious/window";
import { WindowControls } from "macalicious/window-controls";

/* A stand-in for Finder's tag glyph, which is not a system image: an original drawing on the
   measured glyph box, not Apple's artwork. */
function Tag() {
  return (
    <svg width="16" height="10" viewBox="0 0 16 10" aria-hidden="true">
      <path d="M0.5 5l4-4.5h11v9h-11z" fill="none" stroke="currentColor" />
    </svg>
  );
}

/**
 * Visual comparison target: the whole chrome of the key Finder window in Aqua, title bar and
 * default toolbar.
 *
 * Reference crop x=112 y=76 w=1852 h=110 (926 x 55 pt): the full width of the window from its
 * top edge to the separator under the toolbar. Item positions in points from the window's left
 * edge: Back 8, Forward 34, view switcher 170, group 288, action 342, share 396, tags 442,
 * search field 595 (323 wide, ending 8 pt from the right edge). The glyphs are system images
 * (the gear scaled to Finder's 14 pt; the Group button shows `icon-view` as a stand-in for
 * Finder's group glyph) and a stand-in tag. The proxy icon, the title and every glyph except
 * the chevrons are stand-ins or fallback-font text and are masked in the tight comparison.
 *
 * `width`, `space` and `textInset` (the window's width, the fixed space after Forward and the
 * placeholder's inset, in points) let `visual-finder-dark` reuse the bar for the wider Dark
 * Aqua capture, whose placeholder sits where typed text starts.
 */
export default function VisualFinder({ width = 926, space = 95, textInset = 27 }) {
  return (
    <div style={{ ...frame, width }}>
      <Window width={width} height={200} style={{ position: "absolute" }}>
        <TitleBar
          variant="unified"
          title="Castle"
          icon={
            <svg width="16" height="16" viewBox="0 0 16 16" aria-hidden="true">
              <rect x="1" y="5" width="14" height="6" rx="1.5" fill="currentColor" />
            </svg>
          }
          controls={<WindowControls />}
        >
          {toolbar(space, textInset)}
        </TitleBar>
      </Window>
    </div>
  );
}

const frame = {
  position: "relative",
  height: 55,
  overflow: "hidden",
  background: "white",
} as const;

const toolbar = (space: number, textInset: number) => (
  <Toolbar aria-label="Finder toolbar">
    <ToolbarSegmentedControl variant="navigation" tracking="momentary" aria-label="History">
      <ToolbarSegment aria-label="Back" style={{ padding: 0 }}>
        <SystemImage name="go-back" />
      </ToolbarSegment>
      <ToolbarSegment aria-label="Forward" disabled style={{ padding: 0 }}>
        <SystemImage name="go-forward" />
      </ToolbarSegment>
    </ToolbarSegmentedControl>
    <ToolbarSpace width={space} />
    <ToolbarSegmentedControl defaultValue={["columns"]} aria-label="View">
      <ToolbarSegment value="icons" aria-label="Icons">
        <SystemImage name="icon-view" />
      </ToolbarSegment>
      <ToolbarSegment value="list" aria-label="List">
        <SystemImage name="list-view" />
      </ToolbarSegment>
      <ToolbarSegment value="columns" aria-label="Columns" style={{ padding: "0 6px 0 5px" }}>
        <SystemImage name="column-view" />
      </ToolbarSegment>
      <ToolbarSegment value="gallery" aria-label="Gallery">
        <SystemImage name="gallery-view" />
      </ToolbarSegment>
    </ToolbarSegmentedControl>
    <ToolbarButton aria-label="Group" style={{ width: 46, padding: 0, gap: 7 }}>
      <SystemImage name="icon-view" />
      <SystemImage name="chevron-down" />
    </ToolbarButton>
    <ToolbarButton aria-label="Action" style={{ width: 46, padding: 0, gap: 7 }}>
      <SystemImage name="action" scale={14 / 13} />
      <SystemImage name="chevron-down" />
    </ToolbarButton>
    <ToolbarButton aria-label="Share" disabled style={{ width: 38 }}>
      <SystemImage name="share" />
    </ToolbarButton>
    <ToolbarButton aria-label="Edit Tags" disabled style={{ width: 38 }}>
      <Tag />
    </ToolbarButton>
    <ToolbarSpace />
    <ToolbarSearchField
      style={{ width: 323, ["--mac-toolbar-search-field-text-inset" as string]: `${textInset}px` }}
    />
  </Toolbar>
);
