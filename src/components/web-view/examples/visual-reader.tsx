import { WebView, WebViewReader } from "macalicious/web-view";

/**
 * The top of the Reader page: 866 x 80 pt, the 786 pt sheet with 40 pt of canvas on each
 * side, from the view's top edge down to just above the article's title. No text is in it.
 */
export default function VisualReader() {
  return (
    <div style={{ width: 866, height: 80, overflow: "hidden" }}>
      <WebView surface="reader" style={{ height: 300 }}>
        <WebViewReader />
      </WebView>
    </div>
  );
}
