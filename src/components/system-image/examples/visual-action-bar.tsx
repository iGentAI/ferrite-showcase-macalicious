import {
  GradientButton,
  GradientButtonFiller,
  GradientButtonGroup,
} from "macalicious/gradient-button";
import { SystemImage } from "macalicious/system-image";

/**
 * The images are `SystemImage`s here (add, remove, and the action gear with the pull-down
 * chevron 2 pt after it), placed as the gradient button places its own glyphs.
 *
 * Visual comparison target: the add, remove and action buttons under the services list of the
 * Network preference pane, all enabled, and the filler cell.
 *
 * Reference crop (2x pixels) x=144 y=1024 w=180 h=58, i.e. 90 x 29 pt. The bar's outer border
 * starts at x=152, y=1032, 4 pt from the crop's left and top edges. Add and remove have 24 pt
 * of fill (x 154 to 201 and 204 to 251), so each is given `width: 26px`; the action cell has
 * 28 pt (x 254 to 309), which is the button's own width. The gear's ink spans x 258 to 283 and
 * y 1042 to 1067, the chevron's x 288 to 301 and y 1049 to 1057. Above the bar is the list
 * (white in Aqua, #1d1e1f in Dark Aqua) with its own left border, on the window background
 * (#ececec, #2f3031). The list is not part of the component, so it is drawn here with plain
 * styles.
 *
 * In Dark Aqua this bar is drawn lighter than the one in Language & Region, which the
 * component's colours are measured from (fill #4d4e4f against #3c3c3c): see the docs page.
 */
export default function VisualActionBar() {
  return (
    <div
      style={{
        boxSizing: "border-box",
        width: 90,
        height: 29,
        paddingLeft: 4,
        overflow: "hidden",
        background: "light-dark(#ececec, #2f3031)",
      }}
    >
      <div
        style={{
          boxSizing: "border-box",
          height: 4,
          borderLeft: "1px solid light-dark(#c5c5c5, #565656)",
          background: "light-dark(#ffffff, #1d1e1f)",
        }}
      />
      <GradientButtonGroup style={{ display: "flex", width: 140 }}>
        <GradientButton aria-label="Add" style={{ width: 26 }}>
          <SystemImage name="add" />
        </GradientButton>
        <GradientButton aria-label="Remove" style={{ width: 26 }}>
          <SystemImage name="remove" />
        </GradientButton>
        <GradientButton aria-label="Actions">
          <span
            style={{ display: "flex", alignItems: "flex-start", height: 15, marginInlineStart: -2 }}
          >
            <SystemImage name="action" style={{ marginTop: 2 }} />
            <SystemImage name="chevron-down" style={{ margin: "5.5px 0 0 2px" }} />
          </span>
        </GradientButton>
        <GradientButtonFiller />
      </GradientButtonGroup>
    </div>
  );
}
