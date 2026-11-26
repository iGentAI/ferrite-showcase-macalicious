import { SmartSearchField, SmartSearchFieldButton } from "macalicious/smart-search-field";

const caption = {
  font: "var(--mac-font-label)",
  color: "var(--mac-color-label-secondary)",
} as const;
const cell = { display: "grid", gap: 6 } as const;

const reload = <SmartSearchFieldButton glyph="reload" aria-label="Reload this page" />;

/**
 * Every state side by side. Editing is transient, so this gallery pins it with the
 * `data-force` preview attribute.
 */
export default function States() {
  return (
    <div style={{ display: "grid", gap: 14, width: 360, padding: 4 }}>
      <div style={cell}>
        <span style={caption}>A secure page</span>
        <SmartSearchField defaultValue="https://www.example.com/" secure trailing={reload} />
      </div>
      <div style={cell}>
        <span style={caption}>Empty</span>
        <SmartSearchField />
      </div>
      <div style={cell}>
        <span style={caption}>Being edited</span>
        <SmartSearchField defaultValue="https://www.example.com/" data-force="focus" />
      </div>
      <div style={cell}>
        <span style={caption}>Reader on</span>
        <SmartSearchField
          defaultValue="https://www.example.com/article"
          secure
          leading={<SmartSearchFieldButton glyph="reader" pressed aria-label="Reader View" />}
          trailing={<SmartSearchFieldButton glyph="text-size" aria-label="Reader appearance" />}
        />
      </div>
      <div style={cell}>
        <span style={caption}>Disabled</span>
        <SmartSearchField defaultValue="https://www.example.com/" secure disabled />
      </div>
      <div style={cell} data-window-state="inactive">
        <span style={caption}>Inactive window</span>
        <SmartSearchField defaultValue="https://www.example.com/" secure trailing={reload} />
      </div>
    </div>
  );
}
