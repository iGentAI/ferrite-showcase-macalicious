import { ImageWell } from "macalicious/image-well";

// Original artwork for the example: a 32 x 20 pt drawing, smaller than the wells it is in.
const SMALL = `data:image/svg+xml,${encodeURIComponent(
  '<svg xmlns="http://www.w3.org/2000/svg" width="32" height="20" viewBox="0 0 32 20"><path fill="#27356b" d="M0 0h32v20H0z"/><circle cx="23" cy="8" r="3" fill="#ffe2a8"/><path fill="#101528" d="m0 15 9-5 7 4 6-3 10 5v4H0z"/></svg>',
)}`;

const caption = {
  font: "var(--mac-font-label)",
  color: "var(--mac-color-label-secondary)",
} as const;

/** One 32 x 20 pt image in four 80 x 64 pt wells, one per scaling. */
export default function Scaling() {
  return (
    <div style={{ display: "flex", flexWrap: "wrap", gap: 24 }}>
      {(
        ["proportionally-down", "proportionally-up-or-down", "axes-independently", "none"] as const
      ).map((scaling) => (
        <div key={scaling} style={{ display: "grid", gap: 6, justifyItems: "start" }}>
          <ImageWell
            scaling={scaling}
            editable={false}
            src={SMALL}
            alt={`A small drawing, scaling ${scaling}`}
            style={{ width: 80, height: 64 }}
          />
          <span style={caption}>{scaling}</span>
        </div>
      ))}
    </div>
  );
}
