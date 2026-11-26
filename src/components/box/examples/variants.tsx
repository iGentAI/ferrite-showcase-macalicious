import { Box } from "macalicious/box";
import type { CSSProperties } from "react";

const caption = {
  margin: "0 0 6px",
  font: "var(--mac-font-label)",
  color: "var(--mac-color-label-secondary)",
} as const;
const size = { height: 56, "--mac-box-padding": "10px 12px" } as CSSProperties;
const text = { font: "var(--mac-font-body)" } as const;

/** The variants, edges and title positions, on the window background. */
export default function Variants() {
  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "repeat(2, 200px)",
        gap: "20px 24px",
        alignItems: "end",
      }}
    >
      <div>
        <p style={caption}>Untitled</p>
        <Box style={size} aria-label="Untitled box">
          <span style={text}>All four edges</span>
        </Box>
      </div>
      <div>
        <p style={caption}>Title above</p>
        <Box title="Title" style={size}>
          <span style={text}>Content</span>
        </Box>
      </div>
      <div>
        <p style={caption}>Title below</p>
        <Box title="Title" titlePosition="below" style={size}>
          <span style={text}>Content</span>
        </Box>
      </div>
      <div>
        <p style={caption}>Content well</p>
        <Box variant="content" style={size} aria-label="Content well">
          <span style={text}>Opaque, 1 pt border</span>
        </Box>
      </div>
      <div>
        <p style={caption}>Rounded well</p>
        <Box variant="well" style={size} aria-label="Rounded well">
          <span style={text}>1 pt border, 4.5 pt corners</span>
        </Box>
      </div>
      <div>
        <p style={caption}>Horizontal edges (full-bleed band)</p>
        <Box edges="horizontal" style={size} aria-label="Band">
          <span style={text}>Top and bottom only</span>
        </Box>
      </div>
      <div>
        <p style={caption}>Leading edge (detail region)</p>
        <Box edges="leading" style={size} aria-label="Detail region">
          <span style={text}>Leading edge only</span>
        </Box>
      </div>
    </div>
  );
}
