import { ImageView } from "macalicious/image-view";

// Stand-in artwork drawn for this example; the library ships no images.
const svg = (body: string, size = "0 0 48 48") =>
  `data:image/svg+xml,${encodeURIComponent(
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${size}">${body}</svg>`,
  )}`;
const PORTRAIT = svg(
  `<rect width="48" height="48" fill="#f3c98b"/><circle cx="24" cy="19" r="9" fill="#7a4b2a"/>
   <path d="M6 48c2-12 9-17 18-17s16 5 18 17z" fill="#3b6fb6"/>`,
);
const WIDE = svg(
  `<rect width="96" height="48" fill="#9ad0a5"/><circle cx="70" cy="16" r="8" fill="#fff3b0"/>
   <path d="M0 48l28-30 22 22 14-12 32 20z" fill="#3f7d57"/>`,
  "0 0 96 48",
);
const GLYPH = svg(`<path d="M14 22v-7a10 10 0 0120 0v7h3v20H11V22zm5 0h10v-7a5 5 0 00-10 0z"/>`);

const cell = { display: "grid", gap: 6, justifyItems: "start" } as const;
const caption = {
  font: "var(--mac-font-label)",
  color: "var(--mac-color-label-secondary)",
} as const;
const frame = { outline: "1px dashed var(--mac-color-separator)" } as const;

/**
 * Masks, monograms, a disabled picture, a template glyph, and the four scaling modes in a
 * 64 x 64 pt view (outlined here; an image view has no frame of its own).
 */
export default function Variants() {
  return (
    <div
      style={{ display: "grid", gridTemplateColumns: "repeat(4, max-content)", gap: "16px 24px" }}
    >
      <div style={cell}>
        <span style={caption}>Circle mask</span>
        <ImageView src={PORTRAIT} alt="User picture" mask="circle" width={62} height={62} />
      </div>
      <div style={cell}>
        <span style={caption}>Monogram</span>
        <ImageView alt="Stephen Hackett" mask="circle" width={62} height={62}>
          SH
        </ImageView>
      </div>
      <div style={cell}>
        <span style={caption}>Disabled</span>
        <ImageView src={PORTRAIT} alt="Guest User" mask="circle" disabled width={62} height={62} />
      </div>
      <div style={cell}>
        <span style={caption}>Template</span>
        <ImageView src={GLYPH} template alt="Locked" width={32} height={32} />
      </div>
      {(
        ["proportionally-down", "proportionally-up-or-down", "axes-independently", "none"] as const
      ).map((scaling) => (
        <div key={scaling} style={cell}>
          <span style={caption}>{scaling}</span>
          <ImageView
            src={WIDE}
            alt={`Landscape, scaling ${scaling}`}
            scaling={scaling}
            width={64}
            height={64}
            style={frame}
          />
        </div>
      ))}
    </div>
  );
}
