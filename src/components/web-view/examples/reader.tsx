import { WebView, WebViewReader, WebViewReaderTitle } from "macalicious/web-view";

export default function Reader() {
  return (
    <WebView surface="reader" title="Reader" style={{ width: 480, height: 300 }}>
      <WebViewReader style={{ marginInline: 24 }}>
        <WebViewReaderTitle>About this page</WebViewReaderTitle>
        <p style={{ margin: "0 0 18px" }}>
          Reader shows an article on a sheet of paper, without the rest of the page around it.
        </p>
        <p style={{ margin: 0 }}>The sheet is 786 pt wide at most and centred in the view.</p>
      </WebViewReader>
    </WebView>
  );
}
