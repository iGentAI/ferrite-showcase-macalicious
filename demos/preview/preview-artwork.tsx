/**
 * Preview's drawings. None of them is Apple's artwork: the proxy icon, the toolbar and markup
 * glyphs the library's System Image does not have, the share services, the page miniatures
 * and the placeholder picture are original
 * stand-ins. Glyphs are drawn with `currentColor`, so they follow the control they are in; the
 * picture and the miniatures are documents, which keep their own colours in both appearances.
 */
import type { PreviewPage } from "./preview-data";

export type PreviewGlyphName =
  | "zoomOut"
  | "zoomIn"
  | "highlight"
  | "rotate"
  | "markup"
  | "sketch"
  | "adjust"
  | "star"
  | "polygon"
  | "bubble"
  | "ellipseSelect"
  | "lasso"
  | "smartLasso"
  | "mask"
  | "loupe"
  | "draw"
  | "shapes"
  | "text"
  | "mail"
  | "messages"
  | "notes"
  | "select"
  | "rectangle"
  | "oval"
  | "line"
  | "arrow"
  | "crop"
  | "sign"
  | "resize"
  | "rotateRight"
  | "undo"
  | "note";

const PATHS: Record<PreviewGlyphName, string> = {
  // A magnifier with a minus, and with a plus.
  zoomOut: "M10.2 10.2l4.3 4.3M4 6.5h5",
  zoomIn: "M10.2 10.2l4.3 4.3M4 6.5h5M6.5 4v5",
  // A marker pen over the line it draws.
  highlight: "M4.5 9.5l6-7 2.5 2-6 7-3 .8zM2 14h12",
  // A page with an arrow turning to the left over it.
  rotate: "M4.5 7.5h7v6h-7zM11.5 5.5a5 5 0 0 0-5-3.5H3.5M5.5 0.5l-2 1.5 2 1.5",
  // A pen nib in a circle.
  markup: "M8 1.5a6.5 6.5 0 1 0 0 13 6.5 6.5 0 0 0 0-13zM8 4l2.3 5.2L8 11.5 5.7 9.2zM8 4v4.5",
  // A free line.
  sketch: "M2 11c2-6 4-6 5-2s3 4 7-4",
  // A pen.
  draw: "M3 13l1-3.5 7-7 2.5 2.5-7 7zM10 3.5l2.5 2.5",
  // A square behind a circle.
  shapes: "M2.5 2.5h7v7h-7zM10.5 6.6a4 4 0 1 1-4 4",
  // A capital T in a frame.
  text: "M2.5 2.5h11v11h-11zM5.5 5.5h5M8 5.5v5.5",
  // An envelope.
  mail: "M1.5 3.5h13v9h-13zM1.5 4l6.5 5 6.5-5",
  // A speech bubble.
  messages:
    "M8 2.5c3.6 0 6.5 2.2 6.5 5s-2.9 5-6.5 5c-.8 0-1.6-.1-2.3-.3L2.5 13.5l.9-2.6c-1.2-.9-1.9-2.1-1.9-3.4 0-2.8 2.9-5 6.5-5z",
  // A ruled sheet.
  notes: "M3 1.5h10v13H3zM5 5h6M5 7.5h6M5 10h4",
  // An arrow pointer.
  select: "M4 2l8 7.5H8.2l2.3 4.5-1.6.8-2.3-4.5L4 13z",
  // A square, a circle, a line and a line with a head.
  rectangle: "M2.5 3.5h11v9h-11z",
  oval: "M8 3.5c3 0 5.5 2 5.5 4.5S11 12.5 8 12.5 2.5 10.5 2.5 8 5 3.5 8 3.5z",
  line: "M3 13L13 3",
  arrow: "M3 13L13 3M7.5 3H13v5.5",
  // Two crop marks.
  crop: "M4.5 1v10.5H15M1 4.5h10.5V15",
  // A signature over a line.
  sign: "M1.5 10c2-5 3.5-7 4.5-5s-2 6-1 6 3-4 4.5-4-.5 3 1 3 2-2 3.5-2M1.5 13.5h13",
  // A frame with an arrow to its corner.
  resize: "M2.5 2.5h11v11h-11zM6 10l4-4M7 6h3v3",
  // A page with an arrow turning to the right over it.
  rotateRight: "M4.5 7.5h7v6h-7zM4.5 5.5a5 5 0 0 1 5-3.5h3M10.5 0.5l2 1.5-2 1.5",
  // An arrow turning back.
  undo: "M5 4.5L2 7.5l3 3M2 7.5h7a4.5 4.5 0 0 1 0 9",
  // A sheet with its corner folded.
  note: "M2.5 2.5h11v7l-4 4h-7zM13.5 9.5h-4v4",
  // Three sliders, each at its own setting.
  adjust: "M2 4h12M2 8h12M2 12h12M5 2.5v3M11 6.5v3M7 10.5v3",
  star: "M8 1.8l1.9 4 4.3.5-3.2 3 .9 4.3L8 11.4l-3.9 2.2.9-4.3-3.2-3 4.3-.5z",
  polygon: "M8 1.8l5.4 3.1v6.2L8 14.2l-5.4-3.1V4.9z",
  // A rounded box with its tail at the lower left.
  bubble:
    "M4 2.5h8a2 2 0 0 1 2 2v4a2 2 0 0 1-2 2H6.5L3 13.5l.7-3A2 2 0 0 1 2 8.5v-4a2 2 0 0 1 2-2z",
  // A dashed oval, and a dashed free loop.
  ellipseSelect: "M8 3.5c3 0 5.5 2 5.5 4.5S11 12.5 8 12.5 2.5 10.5 2.5 8 5 3.5 8 3.5z",
  lasso: "M8 3c3.5 0 6 1.6 6 3.8S11.5 10.5 8 10.5 2 9 2 6.8 4.5 3 8 3zM6 10.5c-1 1-.8 2.2.4 3",
  // A loop with a magic wand's spark at its side.
  smartLasso:
    "M7 4.5c3.2 0 5.5 1.3 5.5 3.2S10.2 11 7 11 1.5 9.6 1.5 7.7 3.8 4.5 7 4.5zM5.5 11c-1 .9-.7 2 .4 2.7M13 1v3M11.5 2.5h3",
  // A frame with a clear window in it.
  mask: "M1.5 2.5h13v11h-13zM5 5.5h6v5H5z",
  // A round lens with a plus, and its handle.
  loupe: "M6.5 1.5a5 5 0 1 0 0 10 5 5 0 0 0 0-10zM10.2 10.2l4.3 4.3M4.5 6.5h4M6.5 4.5v4",
};

/** A glyph of the toolbar, the markup bar or the Share menu, on a 16 pt square. */
export function PreviewGlyph({ name, size = 16 }: { name: PreviewGlyphName; size?: number }) {
  return (
    <svg
      aria-hidden="true"
      focusable="false"
      fill="none"
      stroke="currentColor"
      viewBox="0 0 16 16"
      width={size}
      height={size}
    >
      {name === "zoomOut" || name === "zoomIn" ? <circle cx="6.5" cy="6.5" r="5" /> : null}
      <path d={PATHS[name]} strokeLinejoin="round" strokeLinecap="round" />
    </svg>
  );
}

/** The document proxy icon of the title bar: a sheet with a picture on it. */
export function DocumentIcon({ kind }: { kind: "pdf" | "image" }) {
  return (
    <svg aria-hidden="true" focusable="false" viewBox="0 0 16 16" width="16" height="16">
      <path d="M3.5 1.5h6l3 3v10h-9z" fill="#ffffff" stroke="#8e8e93" />
      <path d="M9.5 1.5v3h3" fill="none" stroke="#8e8e93" />
      {kind === "pdf" ? (
        <path d="M5.5 7.5h5M5.5 9.5h5M5.5 11.5h3" fill="none" stroke="#8e8e93" />
      ) : (
        <path d="M4.5 12.5l2.5-3 1.5 1.5 1.5-2 1.5 3.5z" fill="#8e8e93" />
      )}
    </svg>
  );
}

/**
 * The picture an image document shows when it has no address: an abstract placeholder, pale
 * bands with a ring and a square on them. It stands for any picture and is not drawn after
 * the one in the screenshots. An SVG in a data: URI, 1600 x 1000, so that it is an image like
 * any other to the view that shows it.
 */
export const PLACEHOLDER_PICTURE = `data:image/svg+xml,${encodeURIComponent(
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 160 100" width="1600" height="1000"
    preserveAspectRatio="none">
    <rect width="160" height="100" fill="#d9dde2"/>
    <path d="M0 70 60 0h34L0 100zM86 100 160 20v36l-40 44z" fill="#c7cdd4"/>
    <circle cx="52" cy="46" r="17" fill="none" stroke="#aab3bd" stroke-width="5"/>
    <rect x="96" y="30" width="30" height="30" fill="#b5bdc6"/>
  </svg>`.replace(/\s+/g, " "),
)}`;

/** A miniature of a page: its banner, if it opens a section, and bars for its lines. */
export function PageMiniature({ page }: { page: PreviewPage }) {
  const opener = page.title !== undefined;
  const top = opener ? 9 : 4;
  const lines = [0, 1, 2, 3, 4, 5].slice(0, opener ? 5 : 6);
  return (
    <svg
      aria-hidden="true"
      focusable="false"
      viewBox="0 0 36 27"
      preserveAspectRatio="none"
      width="100%"
      height="100%"
    >
      <rect width="36" height="27" fill="#ffffff" />
      {opener ? <rect width="36" height="6" fill="#d5d9de" /> : null}
      {opener
        ? lines
            .slice(0, 3)
            .map((line) => (
              <rect key={line} x="3" y={top + line * 3} width="9" height="1" fill="#b9b9b9" />
            ))
        : null}
      {lines.map((line) => (
        <rect
          key={line}
          x={opener ? 15 : 3}
          y={top + line * 3}
          width={(opener ? 18 : 13) - (line % 3 === 2 ? 4 : 0)}
          height="1"
          fill="#8d8d8d"
        />
      ))}
      {opener
        ? null
        : lines.map((line) => (
            <rect
              key={line}
              x="20"
              y={top + line * 3}
              width={13 - (line % 3 === 1 ? 4 : 0)}
              height="1"
              fill="#8d8d8d"
            />
          ))}
    </svg>
  );
}
