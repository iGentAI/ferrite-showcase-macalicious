import { Books } from "../books";
import { capturedBooks } from "../books-data";

/**
 * Visual comparison target: the library window of the two Books captures, 1184 by 784 pt, as
 * it is there: behind the book window and so inactive, with the one book of the captures. The
 * comparisons mask the part the book window and its shadow cover.
 */
export default function VisualLibrary() {
  return (
    <div style={{ width: 1184, height: 784 }}>
      <Books state="inactive" books={capturedBooks} />
    </div>
  );
}
