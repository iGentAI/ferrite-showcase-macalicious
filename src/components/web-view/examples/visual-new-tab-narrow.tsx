import { WebView, WebViewTabThumbnail } from "macalicious/web-view";

/**
 * The new-tab tile in a 1254 pt window, the width of the dark capture: 276 x 211 pt with
 * 10 pt of canvas around it (296 x 231 pt). The + scales with the tile.
 */
export default function VisualNewTabNarrow() {
  return (
    <WebView surface="overview" style={{ width: 296, height: 231, padding: 10 }}>
      <WebViewTabThumbnail
        variant="new-tab"
        aria-label="New Tab"
        style={{ width: 276, height: 211 }}
      />
    </WebView>
  );
}
