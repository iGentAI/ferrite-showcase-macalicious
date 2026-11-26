/**
 * Mirror the browser window's focus onto `data-window-state`, so controls take their
 * inactive-window look (for example, the primary push button loses its accent fill) while the
 * page is in the background, as AppKit windows do.
 *
 * One pair of listeners for the whole page, however many components are mounted. Call it once
 * at start-up; the returned function undoes it.
 *
 * A window component sets the same attribute on its own element for windows inside the page.
 */
export function trackWindowActivation(target: HTMLElement = document.documentElement): () => void {
  const update = () => {
    if (document.hasFocus()) target.removeAttribute("data-window-state");
    else target.setAttribute("data-window-state", "inactive");
  };
  window.addEventListener("focus", update);
  window.addEventListener("blur", update);
  update();
  return () => {
    window.removeEventListener("focus", update);
    window.removeEventListener("blur", update);
    target.removeAttribute("data-window-state");
  };
}
