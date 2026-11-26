"use client";

import { useEffect, useRef } from "react";
import { SystemPreferences } from "../system-preferences";

/**
 * Visual comparison target: the Extensions pane in Aqua, 668 x 508 pt, Share Menu selected and
 * Save to Books marked as new, as in Light-System-Preferences-Extensions. The capture has the
 * keyboard focus in the list of categories, which draws its selection in the accent colour:
 * the list's emphasised selection is pinned here, as a visual test may.
 *
 * Reference crop x=112 y=76 w=1336 h=1016: the opaque frame without its shadow.
 */
export default function VisualExtensions() {
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
      <SystemPreferences style={{ position: "absolute" }} defaultPane="extensions" />
    </div>
  );
}
