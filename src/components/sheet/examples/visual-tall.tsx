import { Sheet, SheetPopup } from "macalicious/sheet";
import { useState } from "react";

/**
 * Visual check target: a sheet with more content than fits. The page is 120 x 60 pt and clips
 * what is inside it, as the viewport does; the sheet hangs from a line 20 pt below its top and
 * holds 200 pt of content. It must end inside the page and scroll: Base UI keeps 5 pt between
 * a popup and the edge it would cross, so the sheet's bottom edge is 55 pt below the top.
 */
export default function VisualTall() {
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
          style={{ padding: 0 }}
        >
          <div style={{ height: 200 }} />
        </SheetPopup>
      </Sheet>
    </div>
  );
}
