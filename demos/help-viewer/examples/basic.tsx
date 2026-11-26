import { HelpViewer } from "../help-viewer";

/**
 * Help Viewer as it opens: the welcome page of the macOS User Guide with the table of contents
 * beside it. Choose an entry or, under its triangle, a topic; Back and Forward walk the pages
 * you opened; type in the search field for the topics that mention a word. The window takes the
 * width the page gives it, up to the captured 877 pt; the margins leave room for its shadow.
 */
export default function Basic() {
  return (
    <div
      style={{
        boxSizing: "border-box",
        width: "100%",
        overflowX: "auto",
        padding: "19px 23px 27px",
      }}
    >
      <HelpViewer width="100%" style={{ minWidth: 540, maxWidth: 877 }} />
    </div>
  );
}
