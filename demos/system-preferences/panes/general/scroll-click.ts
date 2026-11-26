/**
 * General's Click in the scroll bar, on the scrollers the library's ScrollView draws. "Jump to the
 * spot that's clicked" is what a ScrollView does by itself; "Jump to the next page" is taken here,
 * before the press reaches it. A browser's own scroll bars keep the browser's behaviour: a page
 * cannot stop what a press on one of those does.
 */
export const SCROLL_CLICK_KEY = "general.scrollClick";

function pageInstead(event: PointerEvent) {
  if (event.button !== 0 || !(event.target instanceof Element)) return;
  const scroller = event.target.closest(".mac-scroll-view-scroller");
  if (!scroller || event.target.closest(".mac-scroll-view-knob")) return;
  const viewport = scroller.parentElement?.querySelector(":scope > .mac-scroll-view-viewport");
  const knob = scroller.querySelector(".mac-scroll-view-knob")?.getBoundingClientRect();
  if (!viewport || !knob) return;
  event.preventDefault();
  event.stopPropagation();
  if (scroller.getAttribute("data-orientation") === "horizontal") {
    viewport.scrollLeft += event.clientX < knob.left ? -viewport.clientWidth : viewport.clientWidth;
  } else {
    viewport.scrollTop += event.clientY < knob.top ? -viewport.clientHeight : viewport.clientHeight;
  }
}

/** Follow what the settings say: a press jumps by the page unless the person chose the spot. */
export function followScrollClick(values: Readonly<Record<string, unknown>>): void {
  document.removeEventListener("pointerdown", pageInstead, true);
  if (values[SCROLL_CLICK_KEY] !== "spot") {
    document.addEventListener("pointerdown", pageInstead, true);
  }
}

/** Take it off the page, when the person's session ends. */
export function clearScrollClick(): void {
  document.removeEventListener("pointerdown", pageInstead, true);
}
