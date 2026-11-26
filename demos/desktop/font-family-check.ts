/*
 * Whether a font family renders as itself in the browser showing the page: text set in it
 * measures differently from the same text in the generic family it would otherwise fall back to.
 * Used by the desktop's Fonts panels (`desktop-font-panel.tsx`) to dim the families a computer
 * does not have, rather than offer a name whose text would show in another font. It is the
 * desktop's, not the library's: the Fonts panel component dims what a page gives it and
 * measures nothing (its size budget, CONTRIBUTING.md's "Performance rules").
 */

/** Generic families and system keywords: the browser always has a font for them. */
const GENERIC =
  /^(serif|sans-serif|monospace|cursive|fantasy|math|emoji|fangsong|system-ui|ui-serif|ui-sans-serif|ui-monospace|ui-rounded|-apple-system|BlinkMacSystemFont)$/i;

/** Text whose width differs from font to font: wide and narrow letters, figures and signs. */
const SAMPLE = "mmmmmmmmmmlli1WQ@#&";

/** The fallbacks measured against: a family that is missing shows as one of these. */
const FALLBACKS = ["monospace", "serif", "sans-serif"] as const;

/** The first family a CSS `font-family` list names, without its quotes. */
export function firstFamily(css: string): string {
  const first = css.split(",")[0]?.trim() ?? "";
  return first.replace(/^(["'])(.*)\1$/, "$2");
}

/**
 * Whether the family `name` renders as itself in `document`: `true` when text set in it measures
 * otherwise than in a generic fallback (a generic family or system keyword always does), `false`
 * when it measures as each fallback, so the computer has no font of that name, and `undefined`
 * when the document cannot tell (no canvas, or no layout, as in jsdom).
 */
export function familyRenders(name: string, document: Document): boolean | undefined {
  if (GENERIC.test(name)) return true;
  // A document without layout (jsdom) measures nothing; saying so beats dimming every family.
  if (/\bjsdom\b/i.test(document.defaultView?.navigator?.userAgent ?? "")) return undefined;
  const canvas = document.createElement("canvas") as HTMLCanvasElement;
  const context = canvas.getContext?.("2d");
  if (!context) return undefined;
  const quoted = `"${name.replace(/["\\]/g, "\\$&")}"`;
  for (const fallback of FALLBACKS) {
    context.font = `72px ${fallback}`;
    const plain = context.measureText(SAMPLE).width;
    context.font = `72px ${quoted}, ${fallback}`;
    if (context.measureText(SAMPLE).width !== plain) return true;
  }
  return false;
}
