import "./system-preferences.tokens.css";
import "./page-layers.css";

/**
 * Displays on the served desktop: a web page cannot change the screen, so Brightness and Night Shift
 * are layers over this page, which is all they affect.
 */
export const BRIGHTNESS_KEY = "displays.pageBrightness";
export const NIGHT_SHIFT_KEY = "displays.pageNightShift";

/** Dim no further than this, so the page can still be read to undo it. */
export const LEAST_BRIGHTNESS = 0.3;

let dim: HTMLElement | null = null;
let warm: HTMLElement | null = null;

function layer(current: HTMLElement | null, on: boolean, className: string): HTMLElement | null {
  if (!on) {
    current?.remove();
    return null;
  }
  if (current) return current;
  const made = document.createElement("div");
  made.className = className;
  made.setAttribute("aria-hidden", "true");
  document.body.append(made);
  return made;
}

/** Follow what the settings say. */
export function followPageLayers(values: Readonly<Record<string, unknown>>): void {
  const stored = values[BRIGHTNESS_KEY];
  const brightness =
    typeof stored === "number" ? Math.min(1, Math.max(LEAST_BRIGHTNESS, stored)) : 1;
  dim = layer(dim, brightness < 1, "mac-system-preferences-page-dim");
  if (dim) dim.style.opacity = String(1 - brightness);
  warm = layer(warm, values[NIGHT_SHIFT_KEY] === true, "mac-system-preferences-page-warm");
}

/** Take them off the page, when the person's session ends. */
export function clearPageLayers(): void {
  followPageLayers({});
}
