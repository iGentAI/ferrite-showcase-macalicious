import { WebView, WebViewError, WebViewProgress } from "macalicious/web-view";

export default function States() {
  return (
    <div style={{ display: "flex", flexWrap: "wrap", gap: 12 }}>
      <WebView title="Loading page" style={{ width: 240, height: 120 }}>
        <WebViewProgress value={40} aria-label="Loading example.com" />
        <p style={{ margin: 16 }}>A page that is 40% loaded.</p>
      </WebView>
      <WebView title="Missing page" style={{ width: 240, height: 120 }}>
        <WebViewError title="Can’t Open the Page">
          The server “example.invalid” can’t be found.
        </WebViewError>
      </WebView>
      <div data-window-state="inactive">
        <WebView title="Loading in an inactive window" style={{ width: 240, height: 120 }}>
          <WebViewProgress value={40} aria-label="Loading example.com" />
          <p style={{ margin: 16 }}>The same in an inactive window.</p>
        </WebView>
      </div>
    </div>
  );
}
