import { WebView, WebViewTabOverview, WebViewTabThumbnail } from "macalicious/web-view";

/** A drawing of a page: a few bars. The miniature is whatever the application supplies. */
function Miniature({ tint }: { tint: string }) {
  return (
    <span style={{ display: "block", padding: 10 }}>
      <span style={{ display: "block", height: 14, background: tint }} />
      <span style={{ display: "block", height: 4, marginTop: 8, width: "70%", background: tint }} />
      <span style={{ display: "block", height: 4, marginTop: 4, width: "55%", background: tint }} />
    </span>
  );
}

export default function TabOverview() {
  return (
    <WebView surface="overview" title="Tab Overview" style={{ width: 560, height: 190 }}>
      <WebViewTabOverview columns={3} aria-label="Open tabs" style={{ padding: "24px 24px 32px" }}>
        <WebViewTabThumbnail title="Example Domain">
          <Miniature tint="light-dark(#c9d3e6, #46536b)" />
        </WebViewTabThumbnail>
        <WebViewTabThumbnail title="Reference">
          <Miniature tint="light-dark(#d9d2c3, #5d5747)" />
        </WebViewTabThumbnail>
        <WebViewTabThumbnail variant="new-tab" aria-label="New Tab" />
      </WebViewTabOverview>
    </WebView>
  );
}
