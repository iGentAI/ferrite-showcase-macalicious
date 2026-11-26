import { WebView, WebViewFavorite, WebViewFavorites } from "macalicious/web-view";

/** Letter tiles stand in for site artwork; a tile takes a colour from one custom property. */
const tinted = (fill: string) =>
  ({ "--mac-web-view-tile-fill": fill, "--mac-web-view-tile-text": "#ffffff" }) as object;

export default function Favorites() {
  return (
    <WebView surface="start" title="Start page" style={{ width: 400, height: 380 }}>
      <WebViewFavorites heading="Favorites" columns={3}>
        <WebViewFavorite href="https://example.com/" label="Example">
          E
        </WebViewFavorite>
        <WebViewFavorite href="https://example.org/" label="Reference" style={tinted("#4a6da7")}>
          R
        </WebViewFavorite>
        <WebViewFavorite href="https://example.net/" label="Weather" style={tinted("#3d8f6b")}>
          W
        </WebViewFavorite>
        <WebViewFavorite label="News" detail="16 Websites" render={<button type="button" />}>
          N
        </WebViewFavorite>
        <WebViewFavorite href="https://example.edu/" label="Library">
          L
        </WebViewFavorite>
        <WebViewFavorite label="Travel" detail="8 Websites" render={<button type="button" />}>
          T
        </WebViewFavorite>
      </WebViewFavorites>
    </WebView>
  );
}
