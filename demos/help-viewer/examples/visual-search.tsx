import { HelpViewer } from "../help-viewer";
import { CAPTURED_QUERY } from "../help-viewer-data";

/**
 * Visual comparison target: the whole of 10-15-Catalina-Light-Help-Search.png, 1846 x 1536 px,
 * i.e. 923 x 768 pt: the 877 x 722 pt window at (23, 19) with its shadow around it, over the
 * white matte the comparison sets behind the capture's transparent margin.
 *
 * The capture shows the results of a search for "File" in the order the demo ranks them by
 * default. The search field has the keyboard focus there and the pointer is over the first
 * result; the comparisons click the field and hover that row.
 */
export default function VisualSearch() {
  return (
    <div style={{ width: 923, height: 768, background: "white", position: "relative" }}>
      <HelpViewer
        defaultQuery={CAPTURED_QUERY}
        defaultSidebarOpen={false}
        style={{ position: "absolute", left: 23, top: 19 }}
      />
    </div>
  );
}
