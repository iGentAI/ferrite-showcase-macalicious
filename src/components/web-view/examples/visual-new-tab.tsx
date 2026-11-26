import { WebView, WebViewTabThumbnail } from "macalicious/web-view";

/**
 * The new-tab tile of the Tab Overview in a 1324 pt window: 293 x 220 pt with 10 pt of canvas
 * around it (313 x 240 pt).
 */
export default function VisualNewTab() {
  return (
    <WebView surface="overview" style={{ width: 313, height: 240, padding: 10 }}>
      <WebViewTabThumbnail
        variant="new-tab"
        aria-label="New Tab"
        style={{ width: 293, height: 220 }}
      />
    </WebView>
  );
}
