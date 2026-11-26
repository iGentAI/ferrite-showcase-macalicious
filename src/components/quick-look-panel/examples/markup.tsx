import {
  MarkupToolbar,
  MarkupToolbarSeparator,
  MarkupToolbarSwatch,
  MarkupToolbarTool,
} from "macalicious/markup-toolbar";
import { QuickLookPanel, QuickLookPanelButton } from "macalicious/quick-look-panel";
import { useState } from "react";

const glyph = (d: string) => (
  <svg width="16" height="16" viewBox="0 0 16 16" aria-hidden="true">
    <path d={d} fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
  </svg>
);
const SKETCH = "M2 12c2-3 3 2 5-1M9 9l4-6";
const SHAPES = "M2 3h8v8H2zM11 13a3 3 0 100-6 3 3 0 000 6z";
const MARKUP = "M8 1.5a6.5 6.5 0 100 13 6.5 6.5 0 000-13zM5.5 12L8 4.5l2.5 7.5";

/**
 * Markup mode: the Markup button swaps the title for a Markup toolbar and the actions for
 * Done, and the full-screen button goes away. A letterboxed preview shows the frame material.
 */
export default function Markup() {
  const [markup, setMarkup] = useState(true);
  return (
    <div style={{ padding: 24, background: "linear-gradient(135deg, #5b8fc4, #2f9e8f)" }}>
      <QuickLookPanel
        title="Wave.jpg"
        width={520}
        height={300}
        tools={
          markup ? (
            <MarkupToolbar aria-label="Markup">
              <MarkupToolbarTool aria-label="Sketch" selected>
                {glyph(SKETCH)}
              </MarkupToolbarTool>
              <MarkupToolbarTool aria-label="Shapes" menu>
                {glyph(SHAPES)}
              </MarkupToolbarTool>
              <MarkupToolbarSeparator />
              <MarkupToolbarTool aria-label="Fill Colour" menu>
                <MarkupToolbarSwatch />
              </MarkupToolbarTool>
            </MarkupToolbar>
          ) : undefined
        }
        actions={
          markup ? (
            <QuickLookPanelButton onClick={() => setMarkup(false)}>Done</QuickLookPanelButton>
          ) : (
            <QuickLookPanelButton aria-label="Markup" onClick={() => setMarkup(true)}>
              {glyph(MARKUP)}
            </QuickLookPanelButton>
          )
        }
      >
        <div
          role="img"
          aria-label="A wave"
          style={{
            height: "100%",
            aspectRatio: "4 / 3",
            background: "linear-gradient(160deg, #3fae8a, #2c6fa8 55%, #1d3f73)",
          }}
        />
      </QuickLookPanel>
    </div>
  );
}
