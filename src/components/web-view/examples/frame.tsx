import { PushButton } from "macalicious/push-button";
import { WebView } from "macalicious/web-view";
import { useState } from "react";

// A document of the example's own, so the frame needs no network. Any address works as `src`,
// such as "https://example.com/", as long as the site allows framing.
const page = `data:text/html,${encodeURIComponent(
  '<body style="margin:16px;font:13px system-ui,sans-serif;color-scheme:light dark">' +
    "<h1 style=font-size:17px>Framed page</h1><p>This document is in a sandboxed frame.</p>",
)}`;

export default function Frame() {
  const [framed, setFramed] = useState(false);
  const style = { width: 360, height: 120 };
  if (framed) return <WebView src={page} title="Framed page" style={style} />;
  return (
    <WebView title="Framed page" style={{ ...style, display: "grid", placeItems: "center" }}>
      <PushButton onClick={() => setFramed(true)}>Open the page in a frame</PushButton>
    </WebView>
  );
}
