import { ShelfPager } from "macalicious/shelf-pager";

/**
 * The states of a chevron: enabled, disabled, and in a window that is not key, where a focused
 * chevron has no ring. Pressed and focused are transient: press a chevron, or reach one with
 * Tab, to see them.
 */
export default function States() {
  const strip = <div style={{ height: 44 }} />;
  return (
    <div style={{ display: "grid", gap: 8, width: 240 }}>
      <ShelfPager previousLabel="Previous, enabled" nextLabel="Next, enabled">
        {strip}
      </ShelfPager>
      <ShelfPager
        previousDisabled
        nextDisabled
        previousLabel="Previous, disabled"
        nextLabel="Next, disabled"
      >
        {strip}
      </ShelfPager>
      <div data-window-state="inactive">
        <ShelfPager previousLabel="Previous, window not key" nextLabel="Next, window not key">
          {strip}
        </ShelfPager>
      </div>
    </div>
  );
}
