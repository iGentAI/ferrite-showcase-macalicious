import { MenuItem, MenuSeparator } from "macalicious/menu-item";
import { PullDownButton } from "macalicious/pull-down-button";

/**
 * Fixture for the states no reference screenshot shows (pressed, keyboard focus, a window that
 * is not key, the open menu). `pull-down-button.visual.json` puts it into each state with real
 * input and checks the pixels it expects.
 *
 * 216 x 110 pt: 8 pt of page around the button, and room below it for the menu, which is
 * rendered inside the fixture. The button's box is x 8 to 88 and y 8 to 29; the cap's fill is
 * x 71 to 87.
 */
export default function VisualStates() {
  return (
    <div style={{ boxSizing: "border-box", width: 216, height: 110, padding: 8 }}>
      <PullDownButton id="actions" title="Actions" style={{ width: 80 }}>
        <MenuItem data-testid="first">Open in Preview</MenuItem>
        <MenuItem>Save as PDF</MenuItem>
        <MenuSeparator />
        <MenuItem>Send in Mail</MenuItem>
      </PullDownButton>
    </div>
  );
}
