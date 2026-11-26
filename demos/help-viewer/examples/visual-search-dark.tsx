import { HelpViewer } from "../help-viewer";
import { CAPTURED_QUERY, darkRanking } from "../help-viewer-data";

/**
 * Visual comparison target: the whole of 10-15-Catalina-Dark-Help-Search.png, 1846 x 1536 px,
 * i.e. 923 x 768 pt: the 877 x 722 pt window at (23, 19) with its shadow around it, over the
 * white matte the comparison sets behind the capture's transparent margin.
 *
 * The Dark Aqua capture lists other topics first for the same search: the demo shows that
 * order when it is given `darkRanking`. The search field has the keyboard focus, which the
 * comparisons give it with a click; the pointer is over no row.
 */
export default function VisualSearchDark() {
  return (
    <div style={{ width: 923, height: 768, background: "white", position: "relative" }}>
      <HelpViewer
        defaultQuery={CAPTURED_QUERY}
        defaultSidebarOpen={false}
        searchRanking={darkRanking}
        style={{ position: "absolute", left: 23, top: 19 }}
      />
    </div>
  );
}
