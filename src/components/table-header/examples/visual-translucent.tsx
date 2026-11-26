import { TableHeader, TableHeaderCell } from "macalicious/table-header";

/**
 * Visual check target for the translucent variant: a 240 x 24 pt header of two 120 pt
 * columns with short titles at their leading edge, over the content background on its left
 * half and over the emphasised selection colour on its right half, both as measured in the
 * screenshots.
 */
export default function VisualTranslucent() {
  return (
    <div
      style={{
        width: 240,
        height: 24,
        background:
          "linear-gradient(to right, light-dark(#ffffff, #1e1f20) 50%, light-dark(#0164e1, #0158d0) 0)",
      }}
    >
      {/* biome-ignore lint/a11y/useSemanticElements: a header alone needs a table to be a row of; table-view provides the grid */}
      <div role="table" aria-label="Translucent header">
        <TableHeader variant="translucent">
          <TableHeaderCell width={120}>One</TableHeaderCell>
          <TableHeaderCell>Two</TableHeaderCell>
        </TableHeader>
      </div>
    </div>
  );
}
