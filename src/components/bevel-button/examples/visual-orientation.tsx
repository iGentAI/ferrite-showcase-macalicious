import { BevelButton, BevelButtonGroup } from "macalicious/bevel-button";

/* Stand-in pictograms drawn for this example (an arrow and a page); the Print dialog's own
   artwork is not reproduced. The comparison masks them. */
function Page({ landscape = false }: { landscape?: boolean }) {
  return (
    <svg viewBox="0 0 28 25" width="28" height="25" aria-hidden="true" focusable="false">
      <path d="M4 2l3.5 4.5h-2.4V22H2.9V6.5H.5z" fill="currentColor" />
      <path d="M11 3h10.5l4 4v16H11z" fill="#ffffff" stroke="#8e8e8e" strokeWidth="0.5" />
      <circle cx={landscape ? 21 : 18.5} cy={landscape ? 13.5 : 9.5} r="1.8" fill="#1a1a1a" />
      <path d={landscape ? "M12.5 11h6v5h-6z" : "M16.5 12h4v8h-4z"} fill="#1a1a1a" />
    </svg>
  );
}

/**
 * Visual comparison target: the Orientation pair of the Print sheet, portrait on and landscape
 * off.
 *
 * Reference crop (2x pixels) 196 x 96, i.e. 98 x 48 pt, at x=990 y=572 in the light capture and
 * x=904 y=542 in the dark one. Each button is 38 x 38 pt; the first starts 5 pt from the crop's
 * left and top edges and the second is 12 pt further right. The sheet behind them is #efefef in
 * Aqua and a vibrant dark grey, about #2c2d2d, in Dark Aqua.
 */
export default function VisualOrientation() {
  return (
    <div
      style={{
        boxSizing: "border-box",
        width: 98,
        height: 48,
        padding: "5px 0 0 5px",
        background: "light-dark(#efefef, #2c2d2d)",
      }}
    >
      <BevelButtonGroup
        aria-label="Orientation"
        defaultValue={["portrait"]}
        style={{ display: "flex" }}
      >
        <BevelButton value="portrait" aria-label="Portrait">
          <Page />
        </BevelButton>
        <BevelButton value="landscape" aria-label="Landscape">
          <Page landscape />
        </BevelButton>
      </BevelButtonGroup>
    </div>
  );
}
