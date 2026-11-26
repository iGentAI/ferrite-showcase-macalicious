/**
 * Marks elements that are outside the viewport, so that CSS can stop work nobody can see.
 *
 *   const stop = trackOffscreen(element);   // sets data-offscreen while it is off screen
 *   stop();                                 // on unmount
 *
 * One IntersectionObserver is shared by every tracked element, created on first use and
 * disconnected when the last element is released. The attribute is written straight to the
 * DOM: nothing re-renders. An element inside a hidden ancestor (display: none) counts as off
 * screen. Where IntersectionObserver does not exist (server, old browsers) nothing is marked.
 *
 * The progress indicators use it to pause their animation:
 *
 *   .mac-progress-spinner:where([data-offscreen]) … { animation-play-state: paused; }
 */
const ATTRIBUTE = "data-offscreen";

let observer: IntersectionObserver | undefined;
let tracked = 0;

export function trackOffscreen(element: Element): () => void {
  if (typeof IntersectionObserver === "undefined") return () => {};

  observer ??= new IntersectionObserver((entries) => {
    for (const entry of entries) entry.target.toggleAttribute(ATTRIBUTE, !entry.isIntersecting);
  });
  observer.observe(element);
  tracked++;

  let released = false;
  return () => {
    if (released) return;
    released = true;
    observer?.unobserve(element);
    element.removeAttribute(ATTRIBUTE);
    if (--tracked === 0) {
      observer?.disconnect();
      observer = undefined;
    }
  };
}
