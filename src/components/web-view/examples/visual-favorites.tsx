import { WebView, WebViewFavorite, WebViewFavorites } from "macalicious/web-view";

/**
 * Stand-in for a site's artwork: like an image, it covers the whole tile, edge included. Its
 * ground is the #f2f2f2 of the artwork on the first row's tiles in the capture, in both
 * appearances.
 */
function Artwork({ letter }: { letter: string }) {
  return (
    <span
      style={{
        display: "grid",
        placeItems: "center",
        width: "100%",
        height: "100%",
        background: "#f2f2f2",
      }}
    >
      {letter}
    </span>
  );
}

/**
 * The first two columns of the Favorites grid: 213 x 312 pt, starting 30 pt under the view's
 * top edge and 8 pt before the first tile. The view is moved up and left so that the crop
 * shows the heading, two rows of tiles and their titles. The letters stand where the capture
 * has site artwork, which the comparison masks. The second row's tiles are the library's
 * placeholder tile, as in the capture.
 */
export default function VisualFavorites() {
  return (
    <div style={{ position: "relative", width: 213, height: 312, overflow: "hidden" }}>
      <WebView
        surface="start"
        style={{ position: "absolute", left: -12, top: -30, width: 235, height: 360 }}
      >
        <WebViewFavorites heading="Favorites" columns={2}>
          <WebViewFavorite href="https://example.com/" label="Example">
            <Artwork letter="E" />
          </WebViewFavorite>
          <WebViewFavorite href="https://example.org/" label="Notes">
            <Artwork letter="N" />
          </WebViewFavorite>
          <WebViewFavorite label="News" detail="4 Websites" render={<button type="button" />} />
          <WebViewFavorite href="https://example.net/" label="Weather">
            W
          </WebViewFavorite>
        </WebViewFavorites>
      </WebView>
    </div>
  );
}
