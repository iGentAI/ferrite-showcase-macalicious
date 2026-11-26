import { SmartSearchField, SmartSearchFieldButton } from "macalicious/smart-search-field";

/**
 * Visual comparison target: the field of the Safari window in Reader mode, Aqua: the Reader
 * button filled, the text options at the trailing edge.
 *
 * Reference crop (2x pixels) x=896 y=88 w=1080 h=52, i.e. 540 x 26 pt, around the 535 pt fill.
 * The host is the one in the screenshot. The tracking token takes back the 5 pt by which the
 * fallback font sets it wider than San Francisco, so the padlock is scored where the capture
 * has it.
 */
export default function VisualReader() {
  return (
    <div
      style={{
        boxSizing: "border-box",
        width: 540,
        height: 26,
        padding: "2px 2.5px 0",
        background: "linear-gradient(#e4e4e4, #d9d9d9)",
        ["--mac-tracking-regular" as string]: "-0.625px",
      }}
    >
      <SmartSearchField
        defaultValue="https://relay.fm/"
        secure
        leading={<SmartSearchFieldButton glyph="reader" pressed aria-label="Reader View" />}
        trailing={<SmartSearchFieldButton glyph="text-size" aria-label="Reader appearance" />}
      />
    </div>
  );
}
