import { WebView, WebViewProgress } from "macalicious/web-view";

/**
 * Fixture for the checks of the loading line and of the view's focus ring in
 * `web-view.visual.json`, which no screenshot shows: a 200 x 40 pt view on the page surface
 * with a loading line at 50%. The line is x 0 to 100, y 0 to 2.
 */
export default function VisualProgress() {
  return (
    <WebView style={{ width: 200, height: 40 }}>
      <WebViewProgress value={50} aria-label="Loading" />
    </WebView>
  );
}
