/**
 * The rubber band: a press on the background of a view that moves draws a rectangle, and the items
 * it touches are selected. Only the items the view has drawn can be touched, and the view does not
 * scroll on its own while the band is drawn.
 */

/** An item a band can touch. */
export interface MarqueeItem {
  path: string;
  element: Element;
}

export interface MarqueeOptions {
  /** The element the band is drawn in, placed against its own box. */
  container: Element;
  /** The items to touch, read when the band starts. */
  items: () => readonly MarqueeItem[];
  /** What stays selected whatever the band touches: Shift or Command was held. */
  kept: readonly string[];
  /** What was selected at the press, which Escape puts back. */
  before: readonly string[];
  /** The selection now, called only when it changes. */
  onChange: (paths: string[]) => void;
}

/** How far the pointer moves before a press becomes a band, in points. */
const MARQUEE_THRESHOLD = 4;

const touching = (a: DOMRect, b: { left: number; top: number; right: number; bottom: number }) =>
  a.left < b.right && b.left < a.right && a.top < b.bottom && b.top < a.bottom;

/** Follows the pointer from the press `down`. Escape puts the selection back and stops. */
export function beginMarquee(down: PointerEvent, options: MarqueeOptions): void {
  const { container, kept, onChange } = options;
  const page = document.documentElement;
  let band: HTMLElement | null = null;
  let items: { path: string; rect: DOMRect }[] = [];
  let shown = kept.join("\n");

  const move = (event: PointerEvent) => {
    if (event.pointerId !== down.pointerId) return;
    if (!band) {
      if (
        Math.hypot(event.clientX - down.clientX, event.clientY - down.clientY) < MARQUEE_THRESHOLD
      )
        return;
      band = document.createElement("div");
      band.className = "mac-finder-marquee";
      band.setAttribute("aria-hidden", "true");
      container.append(band);
      page.dataset.desktopDragging = "";
      items = options.items().map(({ path, element }) => ({
        path,
        rect: element.getBoundingClientRect(),
      }));
    }
    const outer = container.getBoundingClientRect();
    const left = Math.max(Math.min(down.clientX, event.clientX), outer.left);
    const top = Math.max(Math.min(down.clientY, event.clientY), outer.top);
    const right = Math.min(Math.max(down.clientX, event.clientX), outer.right);
    const bottom = Math.min(Math.max(down.clientY, event.clientY), outer.bottom);
    band.style.left = `${left - outer.left}px`;
    band.style.top = `${top - outer.top}px`;
    band.style.width = `${Math.max(right - left, 0)}px`;
    band.style.height = `${Math.max(bottom - top, 0)}px`;
    const touched = items
      .filter(({ rect }) => touching(rect, { left, top, right, bottom }))
      .map(({ path }) => path);
    const next = [...kept.filter((path) => !touched.includes(path)), ...touched];
    const text = next.join("\n");
    if (text !== shown) {
      shown = text;
      onChange(next);
    }
  };
  const finish = () => {
    window.removeEventListener("pointermove", move, true);
    window.removeEventListener("pointerup", up, true);
    window.removeEventListener("pointercancel", finish, true);
    window.removeEventListener("keydown", key, true);
    window.removeEventListener("blur", finish);
    band?.remove();
    if (band) delete page.dataset.desktopDragging;
  };
  const up = (event: PointerEvent) => {
    if (event.pointerId === down.pointerId) finish();
  };
  const key = (event: KeyboardEvent) => {
    if (event.key !== "Escape" || !band) return;
    event.preventDefault();
    event.stopPropagation();
    finish();
    onChange([...options.before]);
  };
  window.addEventListener("pointermove", move, true);
  window.addEventListener("pointerup", up, true);
  window.addEventListener("pointercancel", finish, true);
  window.addEventListener("keydown", key, true);
  window.addEventListener("blur", finish);
}
