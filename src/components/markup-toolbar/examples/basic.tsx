import {
  MarkupToolbar,
  MarkupToolbarSeparator,
  MarkupToolbarSwatch,
  MarkupToolbarTool,
} from "macalicious/markup-toolbar";
import { useState } from "react";

/* Stand-in glyphs, drawn for this example: Markup's own artwork is Apple's. */
const glyph = (d: string) => (
  <svg width="16" height="16" viewBox="0 0 16 16" aria-hidden="true">
    <path d={d} fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
  </svg>
);
const SKETCH = "M2 12c2-3 3 2 5-1M9 9l4-6";
const DRAW = "M2 12c2-4 4 2 6-2M9.5 8.5l4-5";
const SHAPES = "M2 3h8v8H2zM11 13a3 3 0 100-6 3 3 0 000 6z";
const TEXT = "M2 3h12v10H2zM5.5 6h5M8 6v5";
const ROTATE = "M4 7h8v6H4zM5 4c3-2 6-1 7 2";

export default function Basic() {
  const [tool, setTool] = useState("sketch");
  return (
    <MarkupToolbar aria-label="Markup" style={{ padding: 8 }}>
      <MarkupToolbarTool
        aria-label="Sketch"
        selected={tool === "sketch"}
        onClick={() => setTool("sketch")}
      >
        {glyph(SKETCH)}
      </MarkupToolbarTool>
      <MarkupToolbarTool
        aria-label="Draw"
        selected={tool === "draw"}
        onClick={() => setTool("draw")}
      >
        {glyph(DRAW)}
      </MarkupToolbarTool>
      <MarkupToolbarTool aria-label="Shapes" menu>
        {glyph(SHAPES)}
      </MarkupToolbarTool>
      <MarkupToolbarTool aria-label="Text">{glyph(TEXT)}</MarkupToolbarTool>
      <MarkupToolbarSeparator />
      <MarkupToolbarTool aria-label="Border Colour" menu>
        <MarkupToolbarSwatch variant="border" color="#000000" />
      </MarkupToolbarTool>
      <MarkupToolbarTool aria-label="Fill Colour" menu>
        <MarkupToolbarSwatch />
      </MarkupToolbarTool>
      <MarkupToolbarSeparator />
      <MarkupToolbarTool aria-label="Rotate Left">{glyph(ROTATE)}</MarkupToolbarTool>
    </MarkupToolbar>
  );
}
