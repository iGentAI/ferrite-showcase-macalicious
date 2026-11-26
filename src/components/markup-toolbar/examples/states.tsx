import {
  MarkupToolbar,
  MarkupToolbarSeparator,
  MarkupToolbarSwatch,
  MarkupToolbarTool,
} from "macalicious/markup-toolbar";

const glyph = (
  <svg width="16" height="16" viewBox="0 0 16 16" aria-hidden="true">
    <path
      d="M2 12c2-3 3 2 5-1M9 9l4-6"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
    />
  </svg>
);

function Tools({ label }: { label: string }) {
  return (
    <MarkupToolbar aria-label={label}>
      <MarkupToolbarTool aria-label="Normal">{glyph}</MarkupToolbarTool>
      <MarkupToolbarTool aria-label="Selected" selected>
        {glyph}
      </MarkupToolbarTool>
      <MarkupToolbarTool aria-label="Pressed" data-force="pressed">
        {glyph}
      </MarkupToolbarTool>
      <MarkupToolbarTool aria-label="Focused" data-force="focus">
        {glyph}
      </MarkupToolbarTool>
      <MarkupToolbarTool aria-label="Disabled" disabled>
        {glyph}
      </MarkupToolbarTool>
      <MarkupToolbarSeparator />
      <MarkupToolbarTool aria-label="With a menu" menu>
        {glyph}
      </MarkupToolbarTool>
      <MarkupToolbarTool aria-label="Colour" menu>
        <MarkupToolbarSwatch color="#ff9500" />
      </MarkupToolbarTool>
      <MarkupToolbarTool aria-label="Border colour" menu>
        <MarkupToolbarSwatch variant="border" color="#34c759" />
      </MarkupToolbarTool>
      <MarkupToolbarTool aria-label="No colour" menu>
        <MarkupToolbarSwatch />
      </MarkupToolbarTool>
    </MarkupToolbar>
  );
}

/** Tool states and the three swatches, in a key window and in an inactive one. */
export default function States() {
  return (
    <div style={{ display: "grid", gap: 12 }}>
      <Tools label="Key window" />
      <div data-window-state="inactive">
        <Tools label="Inactive window" />
      </div>
    </div>
  );
}
