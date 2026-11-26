import type { CSSProperties } from "react";
import { useCustomIcon } from "./finder-custom-icon";
import type { FinderNode } from "./finder-data";
import { ALIAS_TYPE } from "./finder-saved";

/*
 * Stand-in artwork, drawn for this demo: none of it is Apple's. Folders are one plain folder
 * shape, applications a coloured tile with the name's first letter, pictures a two-colour
 * gradient, documents a page. The sidebar glyphs are simple line drawings in the row's own
 * colour.
 */

/** A number from a name, the same on the server and in the browser, to vary colours by. */
function hash(text: string): number {
  let value = 0;
  for (let index = 0; index < text.length; index += 1) {
    value = (value * 31 + text.charCodeAt(index)) % 360;
  }
  return value;
}

/** The gradient that stands in for a picture. */
export function pictureBackground(name: string): string {
  const hue = hash(name);
  return `linear-gradient(160deg, hsl(${hue} 55% 60%), hsl(${(hue + 60) % 360} 60% 30%))`;
}

const FOLDER = "M3 13q0-4 4-4h17q3 0 5 3l2 2h26q4 0 4 4v33q0 4-4 4H7q-4 0-4-4z";
const PAGE = "M14 5h25l12 12v42H14z";

/** Colour of the band across a document's page, by kind. */
const BAND: Partial<Record<FinderNode["kind"], string>> = {
  pdf: "#d9534f",
  book: "#f0932b",
  document: "#8e9aa8",
  audio: "#c86dd7",
  movie: "#5b8def",
  file: "#8e9aa8",
};

export interface ItemIconProps {
  node: FinderNode;
  /** Side of the square the icon is drawn in, in points. */
  size: number;
  /** Whether a picture shows itself: without it, the document icon. @default true */
  preview?: boolean;
}

/** The icon of an item at any size: 16 pt in a row, 64 pt and up in the icon view. */
export function ItemIcon({ node, size, preview = true }: ItemIconProps) {
  const custom = useCustomIcon(node.id);
  if (!custom && node.kind === "image" && preview) {
    const wide = node.dimensions !== "2560×1920";
    const frame: CSSProperties = {
      display: "grid",
      placeItems: "center",
      width: size,
      height: size,
    };
    const picture: CSSProperties = {
      width: size >= 32 ? "88%" : "100%",
      aspectRatio: wide ? "16 / 9" : "4 / 3",
      background: pictureBackground(node.name),
      rotate: `${(node.rotation ?? 0) * -90}deg`,
    };
    return (
      <span style={frame} aria-hidden="true">
        <span style={picture} />
      </span>
    );
  }
  return (
    <svg viewBox="0 0 64 64" width={size} height={size} aria-hidden="true">
      {custom ? <image href={custom} width="64" height="64" /> : <ItemShape node={node} />}
      {node.locked ? (
        <g>
          <path d="M12 48v-5a5 5 0 0 1 10 0v5" fill="none" stroke="#3c4148" strokeWidth="2.5" />
          <rect x="8" y="47" width="18" height="13" rx="2" fill="#3c4148" />
        </g>
      ) : null}
    </svg>
  );
}

function ItemShape({ node }: { node: FinderNode }) {
  if (node.type === ALIAS_TYPE) {
    return (
      <>
        <path d={PAGE} fill="#f4f5f6" stroke="#c3c7cc" />
        <rect x="6" y="40" width="18" height="18" rx="3" fill="#ffffff" stroke="#8e9aa8" />
        <path d="M11 53l7-7m-5 0h5v5" fill="none" stroke="#3c4148" strokeWidth="2" />
      </>
    );
  }
  switch (node.kind) {
    case "folder":
      return <path d={FOLDER} fill="#6cc4f5" />;
    case "application":
      return (
        <>
          <rect
            x="4"
            y="4"
            width="56"
            height="56"
            rx="13"
            fill={`hsl(${hash(node.name)} 50% 58%)`}
          />
          <text
            x="32"
            y="43"
            textAnchor="middle"
            fontSize="30"
            fontWeight="600"
            fill="#ffffff"
            fillOpacity="0.9"
          >
            {node.name.charAt(0)}
          </text>
        </>
      );
    case "volume":
      return (
        <>
          <path d="M12 6h40l6 38v14H6V44z" fill="#b9bec4" />
          <path d="M6 44h52v14H6z" fill="#8e949b" />
          <circle cx="50" cy="51" r="2.5" fill="#e8eaec" />
        </>
      );
    case "server":
      return (
        <>
          <rect x="5" y="10" width="54" height="36" rx="3" fill="#5c6570" />
          <rect x="9" y="14" width="46" height="28" fill="#4a90d9" />
          <path d="M24 46h16l2 8H22z" fill="#b9bec4" />
        </>
      );
    case "network":
      return (
        <>
          <circle cx="32" cy="32" r="26" fill="#8e949b" />
          <path
            d="M6 32h52M32 6c-16 16-16 36 0 52c16-16 16-36 0-52"
            fill="none"
            stroke="#e8eaec"
            strokeWidth="3"
          />
        </>
      );
    default:
      return (
        <>
          <path d={PAGE} fill="#f4f5f6" stroke="#b9bec4" strokeWidth="1.5" />
          <path d="M39 5v12h12" fill="none" stroke="#b9bec4" strokeWidth="1.5" />
          <rect x="20" y="36" width="25" height="12" rx="2" fill={BAND[node.kind]} />
        </>
      );
  }
}

const line = { fill: "none", stroke: "currentColor" } as const;

/** An 18 pt line drawing for a sidebar row, in the row's tint. */
export function SidebarGlyph({ name }: { name: keyof typeof SIDEBAR_GLYPHS }) {
  return (
    <svg viewBox="0 0 18 18" width="18" height="18" {...line} strokeWidth="1.5" aria-hidden="true">
      <path d={SIDEBAR_GLYPHS[name]} />
    </svg>
  );
}

export const SIDEBAR_GLYPHS = {
  airdrop: "M9 9h.01M5.5 12.5a5 5 0 1 1 7 0M3 15a8.2 8.2 0 1 1 12 0",
  recents: "M2 10l2-7h10l2 7v5H2zM2 10h4l1 2h4l1-2h4",
  applications: "M4 15L9 3l5 12M2 11h14",
  desktop: "M2 3h14v10H2zM6 16h6",
  documents: "M4 2h7l3 3v11H4zM11 2v3h3",
  downloads: "M9 1.5a7.5 7.5 0 1 1 0 15a7.5 7.5 0 0 1 0-15zM9 5v7M6 9.5l3 3l3-3",
  cloud: "M5 14a3.5 3.5 0 0 1 0-7a4.5 4.5 0 0 1 8.5 1a3 3 0 0 1-.5 6z",
  disk: "M4 2h10l1 9v4H3v-4zM3 11h12",
  computer: "M2 3h14v10H2zM6 16h6",
  movies: "M2 3h14v12H2zM5 3v12M13 3v12M2 7h3M2 11h3M13 7h3M13 11h3",
  music: "M7 14V4l8-2v10M7 14a2 2 0 1 1-4 0a2 2 0 0 1 4 0zM15 12a2 2 0 1 1-4 0a2 2 0 0 1 4 0z",
  pictures: "M2 3h14v12H2zM2 12l4-4l3 3l3-2l4 4M12 6h.01",
  home: "M2 9l7-6l7 6M4 8v8h4v-5h2v5h4V8",
  network:
    "M9 1.5a7.5 7.5 0 1 1 0 15a7.5 7.5 0 0 1 0-15zM1.5 9h15M9 1.5c-5 5-5 10 0 15c5-5 5-10 0-15",
} as const;

export type SidebarGlyphName = keyof typeof SIDEBAR_GLYPHS;

/*
 * Toolbar glyphs: every glyph of the main Finder toolbar (Back, Forward, the four views, Group,
 * Action, Share and Edit Tags) and Rotate Left, in Quick Look's bar, in its Markup bar and in
 * the gallery's Preview pane, is a library system image. The Markup button of the Quick Look
 * panel and the tools of its Markup bar (Sketch, Draw, Shapes, Text, Highlight, Sign, Shape
 * Style, Text Style and Crop) are demo-local drawings in finder-quick-look.tsx.
 */
