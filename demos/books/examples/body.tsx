import { Books } from "../books";

/**
 * The book window rendered into the document's body, whatever element the library is in. A
 * body that is scaled with a CSS transform is the book window's containing block, and the book
 * window is drawn `bookOffset` points, at the body's scale, from the library window. Return or
 * a double click on a cover opens the book.
 */
export default function Body() {
  return (
    <div style={{ position: "relative", width: "100%", padding: "24px 0 48px 24px" }}>
      <Books
        width="100%"
        height={560}
        style={{ maxWidth: 1120 }}
        bookOffset={{ x: 72, y: 56 }}
        readerProps={{ width: 600, height: 480 }}
        windowsContainer={typeof document === "undefined" ? null : document.body}
      />
    </div>
  );
}
