import { SearchField } from "macalicious/search-field";
import { Sidebar, SidebarItem } from "macalicious/sidebar";

const items = Array.from({ length: 12 }, (_, index) => `Item ${index + 1}`);

/**
 * Visual check target for a `header` over a list that scrolls, which no screenshot shows in
 * motion: a 160 x 120 pt pane whose header is a 23 pt search field with 6 pt above and under
 * it and 8 pt beside it, over twelve rows, of which three fit. The checks move the selection
 * to the last row with the keyboard, which scrolls the list to its end, and find the field
 * where it was and the selected row under it.
 */
export default function VisualHeaderPinned() {
  return (
    <Sidebar
      aria-label="Items"
      material="opaque"
      defaultValue="Item 1"
      style={{ width: 160, height: 120 }}
      header={
        <div style={{ padding: "6px 8px" }}>
          <SearchField variant="sidebar" aria-label="Search" style={{ width: "100%" }} />
        </div>
      }
    >
      {items.map((name) => (
        <SidebarItem key={name} value={name} label={name} />
      ))}
    </Sidebar>
  );
}
