import { WebView, WebViewTabThumbnail } from "macalicious/web-view";

/**
 * The top leading corner of a Tab Overview thumbnail: 135 x 45 pt, 20 pt of canvas above and
 * before the tile, then its border and title band. The title is centred in the 293 pt tile,
 * beyond the crop.
 */
export default function VisualThumbnailTop() {
  return (
    <WebView
      surface="overview"
      style={{ width: 135, height: 45, padding: "20px 0 0 20px", overflow: "hidden" }}
    >
      <WebViewTabThumbnail title="News" style={{ width: 293, height: 220 }} />
    </WebView>
  );
}
