"use client";

import { useEffect, useRef } from "react";
import { SystemPreferences } from "../system-preferences";

/**
 * Visual comparison target: the Extensions pane in Dark Aqua, 668 x 508 pt: as the Aqua capture,
 * but with no extension marked as new, as in Dark-System-Preferences-Extensions.
 *
 * Reference crop x=112 y=76 w=1336 h=1016: the opaque frame without its shadow.
 */
export default function VisualExtensionsDark() {
  const frame = useRef<HTMLDivElement>(null);
  useEffect(() => {
    frame.current?.querySelector('[role="listbox"]')?.setAttribute("data-force", "focus");
  }, []);
  return (
    <div
      ref={frame}
      style={{
        position: "relative",
        width: 668,
        height: 508,
        overflow: "hidden",
        background: "white",
      }}
    >
      <SystemPreferences
        style={{ position: "absolute" }}
        defaultPane="extensions"
        defaultSettings={{ "extensions.newExtensions": [] }}
      />
    </div>
  );
}
