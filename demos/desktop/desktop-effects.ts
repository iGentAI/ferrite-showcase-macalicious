/**
 * What an app asks the desktop to do for it after the server carried out a request: open another
 * application, or switch the appearance. Script Editor's scripts, Automator's workflows and Siri
 * answer with such *effects* (`ferrite-apps/desktop/src/apps/automator/actions.rs`), and the page
 * carries them out here, through one window event the desktop listens to (`desktop.tsx`).
 */

/** The window event that carries effects to the desktop. */
export const DESKTOP_EFFECTS_EVENT = "macalicious:desktop-effects";

/** One effect, as the server answers it. */
export type DesktopEffect =
  | { open: string; place?: string }
  | { newWindow: string; opening?: unknown }
  | { quit: string }
  | { appearance: "light" | "dark" | "auto" };

/** The effects of a server reply that this page knows how to carry out. */
export function effectsOf(value: unknown): DesktopEffect[] {
  if (!Array.isArray(value)) return [];
  const effects: DesktopEffect[] = [];
  for (const entry of value) {
    if (!entry || typeof entry !== "object") continue;
    const { open, place, newWindow, opening, quit, appearance } = entry as {
      open?: unknown;
      place?: unknown;
      newWindow?: unknown;
      opening?: unknown;
      quit?: unknown;
      appearance?: unknown;
    };
    if (typeof open === "string" && /^[a-z0-9-]{1,64}$/.test(open)) {
      effects.push(typeof place === "string" && place.startsWith("/") ? { open, place } : { open });
    } else if (typeof quit === "string" && /^[a-z0-9-]{1,64}$/.test(quit)) effects.push({ quit });
    else if (typeof newWindow === "string" && /^[a-z0-9-]{1,64}$/.test(newWindow))
      effects.push({ newWindow, opening });
    else if (appearance === "light" || appearance === "dark" || appearance === "auto")
      effects.push({ appearance });
  }
  return effects;
}

/** Ask the desktop to carry out `effects` (a server reply's `effects`). */
export function requestDesktopEffects(effects: unknown): void {
  const list = effectsOf(effects);
  if (list.length === 0 || typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent(DESKTOP_EFFECTS_EVENT, { detail: list }));
}

/** Hear the effects asked for. Returns the cleanup. */
export function onDesktopEffects(listener: (effects: DesktopEffect[]) => void): () => void {
  const hear = (event: Event) => listener(effectsOf((event as CustomEvent<unknown>).detail));
  window.addEventListener(DESKTOP_EFFECTS_EVENT, hear);
  return () => window.removeEventListener(DESKTOP_EFFECTS_EVENT, hear);
}

/** The window event that tells Script Editor's Record the folder Finder now shows. */
const FINDER_FOLDER_EVENT = "macalicious:finder-folder";

/** Finder shows `path`, as real Finder tells a recording script. */
export function tellFinderFolder(path: string): void {
  window.dispatchEvent(new CustomEvent(FINDER_FOLDER_EVENT, { detail: path }));
}

/** Hear the folders Finder shows. Returns the cleanup. */
export function onFinderFolder(listener: (path: string) => void): () => void {
  const hear = (event: Event) => listener((event as CustomEvent<string>).detail);
  window.addEventListener(FINDER_FOLDER_EVENT, hear);
  return () => window.removeEventListener(FINDER_FOLDER_EVENT, hear);
}
