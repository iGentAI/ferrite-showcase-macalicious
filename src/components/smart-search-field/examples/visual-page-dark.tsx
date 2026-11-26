import { SmartSearchField, SmartSearchFieldButton } from "macalicious/smart-search-field";

/**
 * Visual comparison target: the field of the key Safari window with a page loaded, Dark Aqua.
 *
 * Reference crop (2x pixels) x=856 y=88 w=1020 h=52, i.e. 510 x 26 pt, around the 507 pt fill
 * of the narrower dark window, which starts 1.5 pt from the crop's left edge and 2 pt from
 * its top. The background is the toolbar's gradient over those rows. The tracking token takes
 * back the 5.5 pt by which the fallback font sets the host wider than San Francisco, so the
 * padlock is scored where the capture has it.
 */
export default function VisualPageDark() {
  return (
    <div
      style={{
        boxSizing: "border-box",
        width: 510,
        height: 26,
        padding: "2px 1.5px 0",
        background: "linear-gradient(#3e3f41, #393a3c)",
        ["--mac-tracking-regular" as string]: "-0.423px",
      }}
    >
      <SmartSearchField
        defaultValue="https://512pixels.net/"
        secure
        leading={<SmartSearchFieldButton glyph="reader" aria-label="Reader View" />}
        trailing={<SmartSearchFieldButton glyph="reload" aria-label="Reload this page" />}
      />
    </div>
  );
}
