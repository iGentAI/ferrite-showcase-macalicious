import { WebView, WebViewTabThumbnail } from "macalicious/web-view";

/**
 * The bottom leading corner of a Tab Overview thumbnail: 100 x 60 pt, with the tile's bottom
 * edge 30 pt down and its leading edge 20 pt in, so the shadow under and beside it is inside
 * the crop. The miniature is empty; the comparison masks it.
 */
export default function VisualThumbnailFoot() {
  return (
    <WebView
      surface="overview"
      style={{ position: "relative", width: 100, height: 60, overflow: "hidden" }}
    >
      <WebViewTabThumbnail
        title="News"
        style={{ position: "absolute", left: 20, top: -190, width: 293, height: 220 }}
      />
    </WebView>
  );
}
