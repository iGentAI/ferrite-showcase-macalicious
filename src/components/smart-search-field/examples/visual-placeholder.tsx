import { SmartSearchField } from "macalicious/smart-search-field";

/**
 * Visual comparison target: the empty field of the Favorites window, Aqua: the magnifier and
 * the placeholder, centred.
 *
 * Reference crop (2x pixels) x=896 y=88 w=1080 h=52, i.e. 540 x 26 pt, around the 535 pt fill.
 * This window's toolbar is a little darker than the one over a tab bar. The tracking token
 * takes back the 15.5 pt by which the fallback font sets the placeholder wider than San
 * Francisco, so the magnifier is scored where the capture has it.
 */
export default function VisualPlaceholder() {
  return (
    <div
      style={{
        boxSizing: "border-box",
        width: 540,
        height: 26,
        padding: "2px 2.5px 0",
        background: "linear-gradient(#e1e1e1, #cfcfcf)",
        ["--mac-tracking-regular" as string]: "-0.554px",
      }}
    >
      <SmartSearchField />
    </div>
  );
}
