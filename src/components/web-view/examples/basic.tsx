import { WebView } from "macalicious/web-view";

export default function Basic() {
  return (
    <WebView title="Example page" style={{ width: 360, height: 160 }}>
      <div style={{ padding: "12px 16px" }}>
        <h3 style={{ margin: "0 0 8px", font: "var(--mac-font-headline)" }}>Example Domain</h3>
        <p style={{ margin: "0 0 8px" }}>
          The children of a web view are the page. The view supplies the surface and scrolls
          whatever does not fit.
        </p>
        <p style={{ margin: "0 0 8px" }}>
          This paragraph is here to make the page taller than the view, so that it scrolls.
        </p>
        <p style={{ margin: 0 }}>
          A page can also come from another document: see the framed example below.
        </p>
      </div>
    </WebView>
  );
}
