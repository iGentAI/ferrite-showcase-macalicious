import { ImageView } from "macalicious/image-view";
import type {
  KeychainAccessCategory,
  KeychainAccessKeychainIcon,
  KeychainAccessKind,
} from "./keychain-access-data";

/*
 * Stand-in drawings. Keychain Access shows Apple's colour artwork for keychains, categories
 * and items; these are plain original marks that only keep the kinds apart. Each is drawn
 * once, on a 32 unit grid, and shown by the library's image view at 16 pt in a row and at
 * 64 pt in the summary. The colours are the drawings' own and the same in both appearances,
 * as artwork is.
 */
const METAL = "#c3c6cb";
const METAL_EDGE = "#7c8087";
const BRASS = "#e8a53c";
const BRASS_EDGE = "#b9791c";
const PAPER = "#fbfbfb";
const PAPER_EDGE = "#9a9da3";
const INK = "#6d7178";
const NOTE = "#fbe27a";
const NOTE_EDGE = "#d2b33c";
const SEAL = "#3f8fe0";
const FOLDER = "#6fb2ee";
const FOLDER_EDGE = "#3c83c7";

const KEY = `<circle cx="16" cy="8.5" r="6.5" fill="${METAL}" stroke="${METAL_EDGE}"/><circle cx="16" cy="6.5" r="2" fill="#fff" stroke="${METAL_EDGE}"/><path d="M14 14.5h4V30l-2 1.5-2-1.5z" fill="${METAL}" stroke="${METAL_EDGE}"/><path d="M18 20h3.5v2.5H18zM18 25h2.5v2.5H18z" fill="${METAL}" stroke="${METAL_EDGE}"/>`;
const PAGE = `<path d="M5.5 2.5h21v27h-21z" fill="${PAPER}" stroke="${PAPER_EDGE}"/>`;
const CERTIFICATE = `<path d="M2.5 5.5h27v21h-27z" fill="${PAPER}" stroke="${SEAL}" stroke-width="2"/><path d="M7 11h12M7 15h9" stroke="${INK}" stroke-width="1.5"/><circle cx="22.5" cy="18.5" r="3.5" fill="${BRASS}" stroke="${BRASS_EDGE}"/>`;
const body = (y: number) =>
  `<rect x="8.5" y="${y}" width="15" height="14" rx="2" fill="${BRASS}" stroke="${BRASS_EDGE}"/>`;

const DRAWINGS = {
  key: KEY,
  password: `${PAGE}<path d="M9 9h14M9 13h8" stroke="${INK}" stroke-width="1.5"/><rect x="8.5" y="18.5" width="15" height="6" rx="3" fill="#fff" stroke="${INK}"/><circle cx="12.5" cy="21.5" r="1.2" fill="${INK}"/><circle cx="16" cy="21.5" r="1.2" fill="${INK}"/><circle cx="19.5" cy="21.5" r="1.2" fill="${INK}"/>`,
  note: `<path d="M4.5 3.5h23v18l-7 7h-16z" fill="${NOTE}" stroke="${NOTE_EDGE}"/><path d="M27.5 21.5h-7v7" fill="none" stroke="${NOTE_EDGE}"/><path d="M9 10h14M9 14h14M9 18h8" stroke="${NOTE_EDGE}" stroke-width="1.5"/>`,
  certificate: CERTIFICATE,
  identity: `${CERTIFICATE}<g transform="translate(4 13) scale(.6)">${KEY}</g>`,
  all: `<rect x="3.5" y="4.5" width="18" height="7" rx="1.5" fill="${METAL}" stroke="${METAL_EDGE}"/><rect x="7" y="12.5" width="18" height="7" rx="1.5" fill="${PAPER}" stroke="${PAPER_EDGE}"/><rect x="10.5" y="20.5" width="18" height="7" rx="1.5" fill="${NOTE}" stroke="${NOTE_EDGE}"/>`,
  unlocked: `<path d="M12 17.5V9a4.5 4.5 0 0 1 9 0v2" fill="none" stroke="${METAL_EDGE}" stroke-width="3"/>${body(16.5)}`,
  locked: `<path d="M11.5 17.5V11a4.5 4.5 0 0 1 9 0v6.5" fill="none" stroke="${METAL_EDGE}" stroke-width="3"/>${body(16.5)}`,
  folder: `<path d="M2.5 6.5h10l3 3h14v17h-27z" fill="${FOLDER}" stroke="${FOLDER_EDGE}"/><path d="M2.5 12.5h27" stroke="${FOLDER_EDGE}"/>`,
} as const;

type Drawing = keyof typeof DRAWINGS;

/** A drawing as the address of an SVG image, 64 pt at its own size. */
function source(drawing: Drawing): string {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="64" height="64" viewBox="0 0 32 32">${DRAWINGS[drawing]}</svg>`;
  return `data:image/svg+xml,${encodeURIComponent(svg)}`;
}

const CATEGORY_DRAWINGS: Record<KeychainAccessCategory, Drawing> = {
  all: "all",
  passwords: "password",
  "secure-notes": "note",
  "my-certificates": "identity",
  keys: "key",
  certificates: "certificate",
};

function kindDrawing(kind: KeychainAccessKind): Drawing {
  if (kind === "public key" || kind === "private key") return "key";
  if (kind === "certificate") return "certificate";
  return kind === "secure note" ? "note" : "password";
}

function Icon({ drawing, size = 16 }: { drawing: Drawing; size?: number }) {
  return (
    <ImageView
      src={source(drawing)}
      width={size}
      height={size}
      scaling="proportionally-up-or-down"
    />
  );
}

/** The 16 pt icon before a keychain's name. */
export function KeychainIcon({ icon }: { icon: KeychainAccessKeychainIcon }) {
  return <Icon drawing={icon} />;
}

/** The 16 pt icon before a category's name. */
export function CategoryIcon({ category }: { category: KeychainAccessCategory }) {
  return <Icon drawing={CATEGORY_DRAWINGS[category]} />;
}

/** An item's icon: 16 pt in its row, 64 pt in the summary. */
export function ItemIcon({ kind, size }: { kind: KeychainAccessKind; size?: number }) {
  return <Icon drawing={kindDrawing(kind)} size={size} />;
}
