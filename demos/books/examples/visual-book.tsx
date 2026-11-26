import { BooksReader } from "../books";
import { capturedBook } from "../books-data";

/**
 * Visual comparison target: the book window of 10-15-Catalina-Light-Books.png, 786 by 785 pt,
 * key, on its first page. The comparisons crop its bar and two of its badges: the page and the
 * thumbnails are the book's artwork, which the placeholders stand in for.
 */
export default function VisualBook() {
  return (
    <div style={{ width: 786, height: 785 }}>
      <BooksReader book={capturedBook} />
    </div>
  );
}
