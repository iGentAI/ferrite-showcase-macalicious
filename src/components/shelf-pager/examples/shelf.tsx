import { CardGrid, CardGridCard } from "macalicious/card-grid";
import { ShelfPager } from "macalicious/shelf-pager";
import { type CSSProperties, useEffect, useRef, useState } from "react";

const shows = ["One", "Two", "Three", "Four", "Five", "Six"];

/**
 * Paging a `CardGrid` shelf: the chevrons scroll its list by its own width, and each is
 * disabled at its end. The ends are found again whenever the shelf scrolls or changes size:
 * a wider shelf can reach its end, and a narrower one leave it, without scrolling. A shelf
 * scrolls under its section's margins, so the section keeps only
 * the 14 pt its cards' shadows need and the block around it has the other 26 pt, which leaves
 * the chevrons clear of the cards. The header is 48 pt and the section has 32 pt under the
 * cards, so the chevrons move down 8 pt to be level with the cards.
 */
export default function Shelf() {
  const section = useRef<HTMLElement>(null);
  const [ends, setEnds] = useState({ start: true, end: false });
  const list = () => section.current?.querySelector<HTMLElement>("[role=list]");
  const update = () => {
    const shelf = list();
    if (!shelf) return;
    const start = Math.abs(shelf.scrollLeft) < 1;
    const end = Math.abs(shelf.scrollLeft) + shelf.clientWidth > shelf.scrollWidth - 1;
    setEnds((was) => (was.start === start && was.end === end ? was : { start, end }));
  };
  // biome-ignore lint/correctness/useExhaustiveDependencies: observes the shelf once; `update` reads the element, not state
  useEffect(() => {
    const shelf = list();
    if (!shelf || typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver(update);
    observer.observe(shelf);
    return () => observer.disconnect();
  }, []);
  const page = (by: 1 | -1) => {
    const shelf = list();
    // Right to left, the shelf's later cards are at negative scroll offsets.
    const forward = shelf && getComputedStyle(shelf).direction === "rtl" ? -1 : 1;
    shelf?.scrollBy({ left: by * forward * shelf.clientWidth });
  };
  return (
    <ShelfPager
      previousDisabled={ends.start}
      nextDisabled={ends.end}
      onPrevious={() => page(-1)}
      onNext={() => page(1)}
      previousLabel="Previous shows"
      nextLabel="More shows"
      style={{ width: 520, maxWidth: "100%", "--mac-shelf-pager-offset": "8px" } as CSSProperties}
    >
      <div style={{ margin: "0 26px" }}>
        <CardGrid
          ref={section}
          title="What to Watch"
          layout="shelf"
          columns={3}
          style={{ "--mac-card-grid-margin": "14px" } as CSSProperties}
          onScrollCapture={update}
        >
          {shows.map((name) => (
            <CardGridCard
              key={name}
              title={`Show ${name}`}
              artwork={
                <span
                  style={{
                    background:
                      "linear-gradient(160deg, var(--mac-color-system-indigo), var(--mac-color-label))",
                  }}
                />
              }
            />
          ))}
        </CardGrid>
      </div>
    </ShelfPager>
  );
}
