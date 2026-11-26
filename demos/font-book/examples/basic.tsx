import { FontBook } from "../font-book";

/**
 * Font Book with the fonts and collections of the reference screenshots. Choose a collection
 * in the sidebar and a family or one of its styles in the list; the toolbar changes the view
 * of the preview and searches the list, and the combo box and the slider set the size. The
 * window takes the width the page gives it, up to the captured 1017 pt; the margins leave room
 * for its shadow.
 */
export default function Basic() {
  return (
    <div
      style={{
        boxSizing: "border-box",
        width: "100%",
        overflowX: "auto",
        padding: "31px 48px 67px",
      }}
    >
      <FontBook width="100%" style={{ minWidth: 640, maxWidth: 1017 }} />
    </div>
  );
}
