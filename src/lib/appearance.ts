/**
 * Optional helpers for switching appearance, accent colour and highlight colour at runtime.
 * They only set attributes; all styling lives in the token stylesheets, so the same result can
 * be had by writing the attributes in your HTML.
 */

export type Appearance = "auto" | "light" | "dark";

export const ACCENTS = [
  "blue",
  "purple",
  "pink",
  "red",
  "orange",
  "yellow",
  "green",
  "graphite",
] as const;

/** One of the eight accent colours in System Preferences › General. */
export type Accent = (typeof ACCENTS)[number];

function root(target?: HTMLElement): HTMLElement {
  return target ?? document.documentElement;
}

/** Force Aqua or Dark Aqua, or follow the operating system with "auto". */
export function setAppearance(appearance: Appearance, target?: HTMLElement): void {
  const el = root(target);
  if (appearance === "auto") el.removeAttribute("data-appearance");
  else el.setAttribute("data-appearance", appearance);
}

/** Choose the accent colour. The highlight colour follows unless one was set. */
export function setAccent(accent: Accent, target?: HTMLElement): void {
  root(target).setAttribute("data-accent", accent);
}

/** Choose the highlight colour separately from the accent; "accent" makes it follow again. */
export function setHighlight(highlight: Accent | "accent", target?: HTMLElement): void {
  root(target).setAttribute("data-highlight", highlight);
}
