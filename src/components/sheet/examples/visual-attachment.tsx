import { Sheet, SheetPopup } from "macalicious/sheet";
import { useState } from "react";

/**
 * Visual check target: a whole sheet, 80 x 30 pt, hanging from a line 20 pt below the top of a
 * 120 x 60 pt page (white in Aqua, #1e1e1e in Dark Aqua). The checks read the page above the
 * line, where a sheet casts no shadow, the fill, the rim and the edge.
 */
export default function VisualAttachment() {
  const [stage, setStage] = useState<HTMLDivElement | null>(null);
  const [bar, setBar] = useState<HTMLDivElement | null>(null);
  return (
    <div
      ref={setStage}
      style={{
        position: "relative",
        width: 120,
        height: 60,
        overflow: "hidden",
        background: "light-dark(#ffffff, #1e1e1e)",
      }}
    >
      <div ref={setBar} style={{ height: 20 }} />
      <Sheet open>
        <SheetPopup
          aria-label="Print"
          anchor={bar}
          container={stage}
          width={80}
          style={{ height: 30, padding: 0 }}
        />
      </Sheet>
    </div>
  );
}
