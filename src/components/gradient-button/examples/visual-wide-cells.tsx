import {
  GradientButton,
  GradientButtonFiller,
  GradientButtonGroup,
} from "macalicious/gradient-button";

/**
 * Visual comparison target: the add and remove buttons under the accounts list of the Internet
 * Accounts preference pane, both disabled, whose cells have 24 pt of fill where Language &
 * Region has 23. Each button is given `width: 26px`: the fill and its two borders. An 11 pt
 * glyph cannot be centred in 24 pt on whole points, and AppKit puts the spare point after the
 * plus (ink x 166 to 187 in the fill x 154 to 201) and before the minus (ink x 218 to 239 in
 * the fill x 204 to 251). One more point of padding on that side repeats it.
 *
 * Reference crop (2x pixels) x=144 y=958 w=118 h=58, i.e. 59 x 29 pt. The bar's outer border
 * starts at x=152, y=966, 4 pt from the crop's left and top edges; borders are at x 152, 202
 * and 252, fills x 154 to 201 and 204 to 251. Above the bar is the list (white in Aqua,
 * #1e1e1f in Dark Aqua) with its own left border, on the window background (#ececec, #303031).
 * The list is not part of the component, so it is drawn here with plain styles.
 */
export default function VisualWideCells() {
  return (
    <div
      style={{
        boxSizing: "border-box",
        width: 59,
        height: 29,
        paddingLeft: 4,
        overflow: "hidden",
        background: "light-dark(#ececec, #303031)",
      }}
    >
      <div
        style={{
          boxSizing: "border-box",
          height: 4,
          borderLeft: "1px solid light-dark(#c5c5c5, #646465)",
          background: "light-dark(#ffffff, #1e1e1f)",
        }}
      />
      <GradientButtonGroup style={{ display: "flex", width: 120 }}>
        <GradientButton
          glyph="add"
          aria-label="Add"
          disabled
          style={{ width: 26, paddingInlineEnd: 5 }}
        />
        <GradientButton
          glyph="remove"
          aria-label="Remove"
          disabled
          style={{ width: 26, paddingInlineStart: 5 }}
        />
        <GradientButtonFiller />
      </GradientButtonGroup>
    </div>
  );
}
