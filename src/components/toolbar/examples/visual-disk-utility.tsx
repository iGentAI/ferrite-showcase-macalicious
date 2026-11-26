import { SystemImage } from "macalicious/system-image";
import { TitleBar } from "macalicious/title-bar";
import { Toolbar } from "macalicious/toolbar";
import { ToolbarButton } from "macalicious/toolbar-button";
import { ToolbarLabelledItem } from "macalicious/toolbar-labelled-item";
import { ToolbarSegment, ToolbarSegmentedControl } from "macalicious/toolbar-segmented-control";
import { Window } from "macalicious/window";
import { WindowControls } from "macalicious/window-controls";
import type { ReactNode } from "react";

/* Stand-in glyph: a plain mark where Disk Utility has its artwork. */
function Mark() {
  return (
    <svg width="12" height="12" viewBox="0 0 12 12" aria-hidden="true">
      <circle cx="6" cy="6" r="4.5" fill="none" stroke="currentColor" strokeWidth="1.2" />
    </svg>
  );
}

/* Label, leading edge of the control's fill in points from the window's edge, disabled. */
const buttons = [
  ["First Aid", 333.5, false],
  ["Partition", 386, false],
  ["Erase", 435.5, true],
  ["Restore", 483, true],
  ["Unmount", 539.5, true],
  ["Info", 880, false],
] as const;

function Item({
  label,
  x,
  width,
  children,
}: {
  label: string;
  x: number;
  width: number;
  children: ReactNode;
}) {
  return (
    <ToolbarLabelledItem
      label={label}
      style={{ position: "absolute", left: x, width, gap: 3, overflow: "visible" }}
    >
      {children}
    </ToolbarLabelledItem>
  );
}

/**
 * Visual comparison target: the whole chrome of the Disk Utility window, a unified title bar
 * with an icon-and-label toolbar.
 *
 * Reference crop x=112 y=76 w=1852 h=140 (926 x 70 pt) of the Disk Utility captures, the same
 * in both appearances. Disk Utility's chrome is 2 pt taller than Console's: its controls start
 * 26 pt under the window's top (`--mac-toolbar-padding-top: 4px`) and its labels sit 1 pt
 * lower. The fixture places each item where the capture has it: the View pull-down at 8 pt
 * (46 wide), the Volume pair at 102 pt (59 wide), six 38 pt buttons, some on half points. The
 * glyphs are application artwork and are replaced by plain marks, except the system images
 * (add, remove and the pull-down chevron); glyphs, labels and the title are masked in the
 * tight comparison.
 */
export default function VisualDiskUtility() {
  return (
    <div
      style={{
        position: "relative",
        width: 926,
        height: 70,
        overflow: "hidden",
        background: "white",
      }}
    >
      <Window width={926} height={200} style={{ position: "absolute" }}>
        <TitleBar variant="unified" title="Disk Utility" controls={<WindowControls />}>
          <Toolbar
            displayMode="icon-and-label"
            aria-label="Toolbar"
            style={{ height: 48, ["--mac-toolbar-padding-top" as string]: "4px" }}
          >
            <Item label="View" x={8} width={46}>
              <ToolbarButton style={{ width: 46, padding: 0, gap: 7 }}>
                <Mark />
                <SystemImage name="chevron-down" />
              </ToolbarButton>
            </Item>
            <Item label="Volume" x={102} width={59}>
              <ToolbarSegmentedControl tracking="momentary" style={{ width: 59 }}>
                <ToolbarSegment
                  aria-label="Add Volume"
                  style={{ flex: "none", width: 30, padding: 0 }}
                >
                  <SystemImage name="add" />
                </ToolbarSegment>
                <ToolbarSegment aria-label="Delete Volume" disabled style={{ padding: 0 }}>
                  <SystemImage name="remove" />
                </ToolbarSegment>
              </ToolbarSegmentedControl>
            </Item>
            {buttons.map(([label, x, disabled]) => (
              <Item key={label} label={label} x={x} width={38}>
                <ToolbarButton disabled={disabled} style={{ width: 38, padding: 0 }}>
                  <Mark />
                </ToolbarButton>
              </Item>
            ))}
          </Toolbar>
        </TitleBar>
      </Window>
    </div>
  );
}
