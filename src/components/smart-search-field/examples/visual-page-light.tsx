import { SmartSearchField, SmartSearchFieldButton } from "macalicious/smart-search-field";

/**
 * Visual comparison target: the field of the key Safari window with a page loaded, Aqua.
 *
 * Reference crop (2x pixels) x=896 y=88 w=1080 h=52, i.e. 540 x 26 pt, around the 535 pt fill,
 * which starts 2.5 pt from the crop's left edge and 2 pt from its top. The background is the
 * toolbar's gradient over those rows. The host is the one in the screenshot.
 *
 * The fallback font used off Apple platforms sets the host 5.5 pt wider than San Francisco,
 * which would move the padlock; the tracking token, the hook for a fallback font, takes that
 * width back so the padlock is scored where the capture has it.
 */
export default function VisualPageLight() {
  return (
    <div
      style={{
        boxSizing: "border-box",
        width: 540,
        height: 26,
        padding: "2px 2.5px 0",
        background: "linear-gradient(#e4e4e4, #d9d9d9)",
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
