import { BooksReader } from "../books";
import { capturedBook } from "../books-data";

/**
 * Visual comparison target: the book window of 10-15-Catalina-Dark-Books.png, which is wider
 * than the Aqua capture's: 1024 by 785 pt, key, on its first page.
 */
export default function VisualBookDark() {
  return (
    <div style={{ width: 1024, height: 785 }}>
      <BooksReader book={capturedBook} width={1024} />
    </div>
  );
}
