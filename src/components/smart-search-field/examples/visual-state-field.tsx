import { SmartSearchField, SmartSearchFieldButton } from "macalicious/smart-search-field";

/**
 * Fixture for the states no reference screenshot shows (the focus ring in Aqua, editing in a
 * window that is not key, a pressed accessory, a disabled field) and for the Reader button's
 * "on" fill in Dark Aqua. `smart-search-field.visual.json` puts it into each state with real
 * input and checks the pixels it expects.
 *
 * 316 x 68 pt on the page background: 8 pt of page on every side, so the focus ring is inside
 * the capture. The first field's fill is x 8 to 308, y 8 to 30; the disabled one's y 38 to 60.
 * In both, the Reload glyph's box is x 290.5 to 301.5 and its arrowhead is around x 296.8,
 * 6.75 pt below the fill's top; the Reader button is the first 28 pt of the first field.
 */
export default function VisualStateField() {
  return (
    <div style={{ display: "grid", gap: 8, width: 300, padding: 8 }}>
      <SmartSearchField
        id="field"
        defaultValue="https://www.example.com/"
        secure
        leading={<SmartSearchFieldButton glyph="reader" pressed aria-label="Reader View" />}
        trailing={
          <SmartSearchFieldButton id="reload" glyph="reload" aria-label="Reload this page" />
        }
      />
      <SmartSearchField
        aria-label="Disabled address"
        defaultValue="https://www.example.com/"
        secure
        disabled
        trailing={<SmartSearchFieldButton glyph="reload" disabled aria-label="Reload" />}
      />
    </div>
  );
}
