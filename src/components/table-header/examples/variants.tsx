import { TableHeader, TableHeaderCell } from "macalicious/table-header";
import { type CSSProperties, useState } from "react";

const caption = {
  margin: "12px 0 4px",
  font: "var(--mac-font-control-small)",
  color: "var(--mac-color-label)",
};

/* What the translucent header is over here: the stripes of a table, steeper than a table's
   own so that they can be seen through it. */
const stripes: CSSProperties = {
  background:
    "repeating-linear-gradient(to right, var(--mac-color-control-background-tinted) 0 30px, var(--mac-color-selected-content-background-unemphasized) 0 60px)",
};

/* The hook for the titles, set to where Console has its own. */
const titles = { "--mac-table-header-title-inset": "2px 6px" } as CSSProperties;

/** The three fills, the three alignments, both sort directions and resizable columns. */
export default function Variants() {
  const [widths, setWidths] = useState([140, 100]);
  const resize = (index: number) => (width: number) =>
    setWidths((old) => old.map((value, at) => (at === index ? width : value)));
  return (
    <div style={{ width: 420 }}>
      <p style={{ ...caption, marginTop: 0 }}>Standard, with a top border: left, centred, right</p>
      {/* biome-ignore lint/a11y/useSemanticElements: a header alone needs a table to be a row of; table-view provides the grid */}
      <div role="table" aria-label="Alignments">
        <TableHeader topBorder>
          <TableHeaderCell sortDirection="ascending">Name</TableHeaderCell>
          <TableHeaderCell align="center" sortDirection="descending">
            % CPU
          </TableHeaderCell>
          <TableHeaderCell align="right">Size</TableHeaderCell>
        </TableHeader>
      </div>
      <p style={caption}>Plain, on the content background</p>
      {/* biome-ignore lint/a11y/useSemanticElements: a header alone needs a table to be a row of; table-view provides the grid */}
      <div role="table" aria-label="Plain header">
        <TableHeader variant="plain">
          <TableHeaderCell width={53}>Type</TableHeaderCell>
          <TableHeaderCell width={173}>Time</TableHeaderCell>
          <TableHeaderCell>Message</TableHeaderCell>
        </TableHeader>
      </div>
      <p style={caption}>Translucent, as in Console: what is behind it shows through</p>
      {/* biome-ignore lint/a11y/useSemanticElements: a header alone needs a table to be a row of; table-view provides the grid */}
      <div role="table" aria-label="Translucent header" style={stripes}>
        <TableHeader variant="translucent" style={titles}>
          <TableHeaderCell width={53}>Type</TableHeaderCell>
          <TableHeaderCell width={173}>Time</TableHeaderCell>
          <TableHeaderCell>Message</TableHeaderCell>
        </TableHeader>
      </div>
      <p style={caption}>Resizable: drag a separator, or focus a heading and press Option-Arrow</p>
      {/* biome-ignore lint/a11y/useSemanticElements: a header alone needs a table to be a row of; table-view provides the grid */}
      <div role="table" aria-label="Resizable columns">
        <TableHeader topBorder>
          <TableHeaderCell width={widths[0]} minWidth={60} maxWidth={220} onResize={resize(0)}>
            Name
          </TableHeaderCell>
          <TableHeaderCell width={widths[1]} minWidth={60} maxWidth={160} onResize={resize(1)}>
            Kind
          </TableHeaderCell>
          <TableHeaderCell>Date Modified</TableHeaderCell>
        </TableHeader>
      </div>
    </div>
  );
}
