import { Books } from "../books";

/**
 * Choose a row of the sidebar, reorder the covers with Sort By, search, and double-click a
 * cover (or press Return on it) to open the book: its window comes up over the library, and
 * its thumbnails and the arrow keys turn the pages. The cover, the pages and the thumbnails
 * are placeholders. The book window is smaller here than in Catalina, to fit the page.
 */
export default function Basic() {
  return (
    <div style={{ position: "relative", width: "100%", paddingBlockEnd: 48 }}>
      <Books
        width="100%"
        height={620}
        style={{ maxWidth: 1184 }}
        bookOffset={{ x: 72, y: 56 }}
        readerProps={{ width: 640, height: 560 }}
      />
    </div>
  );
}
