import { SearchField } from "macalicious/search-field";

const cell = { display: "grid", gap: 6, justifyItems: "start" } as const;
const caption = {
  font: "var(--mac-font-label)",
  color: "var(--mac-color-label-secondary)",
} as const;

/** Every state side by side. Focus is pinned with the `data-force` preview attribute. */
export default function States() {
  return (
    <div
      style={{ display: "grid", gridTemplateColumns: "repeat(3, max-content)", gap: "16px 28px" }}
    >
      <div style={cell}>
        <span style={caption}>Empty</span>
        <SearchField aria-label="Empty" />
      </div>
      <div style={cell}>
        <span style={caption}>With text</span>
        <SearchField aria-label="With text" defaultValue="Mac Power Users" />
      </div>
      <div style={cell}>
        <span style={caption}>Focused</span>
        <SearchField aria-label="Focused" data-force="focus" />
      </div>
      <div style={cell}>
        <span style={caption}>Disabled</span>
        <SearchField aria-label="Disabled" disabled />
      </div>
      <div style={cell} data-window-state="inactive">
        <span style={caption}>Inactive window, focused</span>
        <SearchField aria-label="Inactive window" data-force="focus" />
      </div>
    </div>
  );
}
