import { Menu } from "@base-ui/react/menu";
import { GradientButton, GradientButtonGroup } from "macalicious/gradient-button";

/**
 * Fixture for the pull-down behaviour, which no reference screenshot shows open: an action
 * button that is the trigger of a Base UI menu, beside an add button. `gradient-button.visual.json`
 * opens the menu with a real click and checks that the trigger is drawn as pressed while its
 * menu is open. The menu itself is not part of this component and is left unstyled; it opens
 * below the trigger, over the bottom of the capture, clear of the pixels that are checked.
 *
 * 70 x 37 pt: 8 pt of page on every side. Add is x 8 to 33, the action button x 32 to 62, both
 * y 8 to 29 with a 1 pt border.
 */
export default function VisualPullDown() {
  return (
    <div style={{ display: "flex", padding: 8 }}>
      <GradientButtonGroup>
        <GradientButton glyph="add" aria-label="Add" />
        <Menu.Root>
          <Menu.Trigger
            render={<GradientButton id="action" glyph="action" aria-label="Actions" />}
          />
          <Menu.Portal>
            <Menu.Positioner>
              <Menu.Popup>
                <Menu.Item>Duplicate</Menu.Item>
              </Menu.Popup>
            </Menu.Positioner>
          </Menu.Portal>
        </Menu.Root>
      </GradientButtonGroup>
    </div>
  );
}
