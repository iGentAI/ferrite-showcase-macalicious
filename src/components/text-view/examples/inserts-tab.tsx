import { TextView } from "macalicious/text-view";

/**
 * A view for tab-separated text: with `insertsTab`, Tab inserts a tab character as in an
 * AppKit text view. Escape followed by Tab, or Shift-Tab, leaves the view.
 */
export default function InsertsTab() {
  return (
    <div style={{ width: 320, height: 72 }}>
      <TextView
        aria-label="Tab-separated values"
        aria-description="Tab inserts a tab. Press Escape, then Tab, to leave."
        monospace
        insertsTab
        defaultValue={"name\tsize\nNotes\t4 KB"}
      />
    </div>
  );
}
