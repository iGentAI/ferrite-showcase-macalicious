import { PushButton } from "macalicious/push-button";
import { useState } from "react";
import { Finder } from "../finder";

const DISK = "/Volumes/Macintosh HD";

/**
 * A disk that goes without having been ejected. The button stands for pulling its cable, which
 * is nothing Finder has a command for: the page tells the window through `disconnected`. The
 * disk leaves the sidebar, and the notification about it stays until Close.
 */
export default function EjectWarning() {
  const [disconnected, setDisconnected] = useState<readonly string[]>([]);
  return (
    <div style={{ display: "grid", gap: 12, justifyItems: "start" }}>
      <PushButton disabled={disconnected.length > 0} onClick={() => setDisconnected([DISK])}>
        Disconnect “Macintosh HD”
      </PushButton>
      <Finder
        material="opaque"
        width="100%"
        height={420}
        style={{ maxWidth: 1080 }}
        disconnected={disconnected}
      />
    </div>
  );
}
