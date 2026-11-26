/**
 * The fonts of the Fonts panel and of the format bars: the families that come with macOS
 * Catalina, with CSS fallbacks for systems without them, their typefaces, the panel's
 * collections and AppKit's list of sizes. `macalicious/lib/rich-text` re-exports all of it.
 */

/** A typeface of a family: its name in the Fonts panel and the styles it stands for. */
export interface FontTypeface {
  name: string;
  bold: boolean;
  italic: boolean;
}

/** A font family the Fonts panel lists. */
export interface FontFamily {
  /** The name shown, and the first family of `css`. */
  name: string;
  /** The CSS `font-family` that sets it, with fallbacks for systems without it. */
  css: string;
  /** Its four typefaces, in the panel's order. */
  typefaces: readonly FontTypeface[];
  /** The Fonts panel's collections it belongs to, beside All Fonts. */
  collections: readonly string[];
}

const faces = (italic: string): readonly FontTypeface[] => [
  { name: "Regular", bold: false, italic: false },
  { name: italic, bold: false, italic: true },
  { name: "Bold", bold: true, italic: false },
  { name: `Bold ${italic}`, bold: true, italic: true },
];
const ITALIC = faces("Italic");
const OBLIQUE = faces("Oblique");
const family = (
  name: string,
  css: string,
  collections: readonly string[],
  typefaces = ITALIC,
): FontFamily => ({ name, css, typefaces, collections });

/** The collections of the Fonts panel, in its order. */
export const FONT_COLLECTIONS = [
  "All Fonts",
  "Fixed Width",
  "Fun",
  "Modern",
  "Traditional",
  "Web",
] as const;

/**
 * Font families that come with macOS Catalina, by the names its Fonts panel shows. A page can
 * only show a family the visitor's system has; each one falls back to a close relative.
 */
export const FONT_FAMILIES: readonly FontFamily[] = [
  family("American Typewriter", "'American Typewriter', 'Courier New', serif", ["Fun"]),
  family("Arial", "Arial, Helvetica, sans-serif", ["Modern", "Web"]),
  family("Avenir Next", "'Avenir Next', Avenir, 'Segoe UI', sans-serif", ["Modern"]),
  family("Baskerville", "Baskerville, 'Baskerville Old Face', Georgia, serif", ["Traditional"]),
  family("Chalkboard", "Chalkboard, 'Comic Sans MS', cursive", ["Fun"]),
  family("Courier", "Courier, 'Courier New', monospace", ["Fixed Width"], OBLIQUE),
  family("Futura", "Futura, 'Century Gothic', sans-serif", ["Modern"]),
  family("Georgia", "Georgia, serif", ["Traditional", "Web"]),
  family("Gill Sans", "'Gill Sans', 'Gill Sans MT', sans-serif", ["Modern"]),
  family("Helvetica", "Helvetica, Arial, sans-serif", ["Modern"], OBLIQUE),
  family("Helvetica Neue", "'Helvetica Neue', Helvetica, Arial, sans-serif", ["Modern"]),
  family("Lucida Grande", "'Lucida Grande', 'Lucida Sans Unicode', sans-serif", ["Modern"]),
  family("Marker Felt", "'Marker Felt', 'Comic Sans MS', cursive", ["Fun"]),
  family("Menlo", "Menlo, Monaco, Consolas, monospace", ["Fixed Width"]),
  family("Monaco", "Monaco, Menlo, Consolas, monospace", ["Fixed Width"]),
  family("Noteworthy", "Noteworthy, 'Comic Sans MS', cursive", ["Fun"]),
  family("Optima", "Optima, Candara, sans-serif", ["Modern"]),
  family("Palatino", "Palatino, 'Palatino Linotype', 'Book Antiqua', serif", ["Traditional"]),
  family("Times", "Times, 'Times New Roman', serif", ["Traditional"]),
  family("Times New Roman", "'Times New Roman', Times, serif", ["Traditional", "Web"]),
  family("Trebuchet MS", "'Trebuchet MS', sans-serif", ["Web"]),
  family("Verdana", "Verdana, Geneva, sans-serif", ["Web"]),
];

/** The sizes of the Fonts panel's list and of AppKit's size menus, in points. */
export const FONT_SIZES = [9, 10, 11, 12, 13, 14, 18, 24, 36, 48, 64, 72, 96, 144, 288] as const;

/** The family of that name, whatever its case, or `undefined`. */
export function findFontFamily(name: string): FontFamily | undefined {
  const wanted = name.trim().toLowerCase();
  return FONT_FAMILIES.find((each) => each.name.toLowerCase() === wanted);
}
