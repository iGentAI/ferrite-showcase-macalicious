import { Sheet, SheetPopup } from "macalicious/sheet";
import { useState } from "react";

/**
 * Visual comparison target: the bottom edge of the Print sheet where it lies over the page of
 * the TextEdit window behind it (white in Aqua, #1e1e1e in Dark Aqua). The comparisons capture
 * the part marked `data-crop`, 100 x 40 pt: the last 15 pt of the sheet, its 0.5 pt edge and
 * 24.5 pt of its shadow.
 *
 * The sheet is rendered into this box instead of the document body, so that it is part of the
 * capture, and hangs from a line 5 pt below the top of the box; it is 80 pt tall and wider
 * than the box, so its sides are outside.
 */
export default function VisualBottomEdge() {
  const [stage, setStage] = useState<HTMLDivElement | null>(null);
  const [line, setLine] = useState<HTMLDivElement | null>(null);
  return (
    <div
      ref={setStage}
      style={{
        position: "relative",
        width: 100,
        height: 110,
        overflow: "hidden",
        background: "light-dark(#ffffff, #1e1e1e)",
      }}
    >
      <div ref={setLine} style={{ height: 5 }} />
      <div
        data-crop="bottom"
        style={{ position: "absolute", top: 70, left: 0, width: 100, height: 40 }}
      />
      <Sheet open>
        <SheetPopup
          aria-label="Print"
          anchor={line}
          container={stage}
          width={300}
          style={{ height: 80 }}
        />
      </Sheet>
    </div>
  );
}
