import { type CSSProperties, useState } from "react";
import { Books } from "../books";

/**
 * The book window rendered into an element of the page's own, given as `windowsContainer`.
 * That element is not positioned and is set in from the positioned element around it, so the
 * book window, which is placed against the positioned one, is measured where it lands and kept
 * at `bookOffset` from the library window. The library's `zIndex` is a custom property set on
 * it alone; the book window stands on the level it comes to, and the window in front is still
 * the one drawn over the other. Click either window to bring it forward.
 */
export default function Container() {
  const [container, setContainer] = useState<HTMLDivElement | null>(null);
  return (
    <div style={{ position: "relative", width: "100%", padding: "40px 0 48px 32px" }}>
      <div ref={setContainer} className="books-example-container" style={{ marginTop: 24 }}>
        <Books
          width="100%"
          height={560}
          style={
            { maxWidth: 1120, "--books-layer": 10, zIndex: "var(--books-layer)" } as CSSProperties
          }
          defaultOpenBook="aqua-and-bondi"
          bookOffset={{ x: 72, y: 56 }}
          readerProps={{ width: 600, height: 480 }}
          windowsContainer={container}
        />
      </div>
    </div>
  );
}
