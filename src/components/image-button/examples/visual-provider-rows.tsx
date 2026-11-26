import { ImageButton } from "macalicious/image-button";

function Logo() {
  return (
    <svg viewBox="0 0 120 30" width="120" height="30" aria-hidden="true" focusable="false">
      <rect width="120" height="30" rx="15" fill="#6aa6d8" />
    </svg>
  );
}

const divider = { height: 2, background: "var(--mac-color-separator)" } as const;

/**
 * Visual comparison target: the left end of two provider rows of Internet Accounts, in the
 * box of the pane (#e3e3e3 in Aqua, #363637 in Dark Aqua).
 *
 * Reference crop (2x pixels) x=596 y=700 w=200 h=160, i.e. 100 x 80 pt, 3 pt inside the box's
 * left edge. In the crop a divider spans y 720 to 723, a row y 724 to 831 (54 pt), the next
 * divider y 832 to 835, and the last row starts at y 836. The rows are 410 pt wide and their
 * logos are centred, so no logo reaches the crop: what is scored is the height of a row and
 * the place of the dividers, which the list draws.
 */
export default function VisualProviderRows() {
  return (
    <div
      style={{
        overflow: "hidden",
        width: 100,
        height: 80,
        background: "light-dark(#e3e3e3, #363637)",
      }}
    >
      <div style={{ width: 410, margin: "-44px 0 0 -3px" }}>
        <ImageButton layout="row" aria-label="First">
          <Logo />
        </ImageButton>
        <div style={divider} />
        <ImageButton layout="row" aria-label="Second">
          <Logo />
        </ImageButton>
        <div style={divider} />
        <ImageButton layout="row">Add Other Account…</ImageButton>
      </div>
    </div>
  );
}
