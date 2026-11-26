import { Box } from "macalicious/box";
import type { CSSProperties } from "react";

/** A titled box. `--mac-box-padding` sets the padding of the surface. */
export default function Basic() {
  return (
    <Box
      title="Interface information"
      style={{ width: 300, "--mac-box-padding": "12px 20px" } as CSSProperties}
    >
      <dl
        style={{
          display: "grid",
          gridTemplateColumns: "max-content 1fr",
          gap: "4px 8px",
          margin: 0,
          font: "var(--mac-font-body)",
        }}
      >
        <dt>Link Speed:</dt>
        <dd style={{ margin: 0 }}>1 Gbit/s</dd>
        <dt>Link Status:</dt>
        <dd style={{ margin: 0 }}>Active</dd>
      </dl>
    </Box>
  );
}
