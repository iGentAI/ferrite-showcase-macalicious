import { useState } from "react";
import { Books } from "../books";

/**
 * The book window in an element of the page's own that is a stacking context (`position:
 * relative; z-index: 0`) and comes after the library window, which has a `zIndex` of 11. The
 * library's level is set against that element's, so the window in front is still the one drawn
 * over the other. The book window also has a margin and a transform of its own; it is drawn
 * `bookOffset` points from the library window's corner all the same. Click either window to
 * bring it forward.
 */
export default function Stacked() {
  const [layer, setLayer] = useState<HTMLDivElement | null>(null);
  return (
    <div style={{ position: "relative", width: "100%", padding: "24px 0 48px 24px" }}>
      <Books
        width="100%"
        height={560}
        style={{ maxWidth: 1120, zIndex: 11 }}
        defaultOpenBook="aqua-and-bondi"
        bookOffset={{ x: 72, y: 56 }}
        readerProps={{
          width: 600,
          height: 480,
          style: { margin: "12px 0 0 20px", transform: "translate(30px, 20px)" },
        }}
        windowsContainer={layer}
      />
      <div
        ref={setLayer}
        className="books-example-layer"
        style={{ position: "relative", zIndex: 0 }}
      />
    </div>
  );
}
