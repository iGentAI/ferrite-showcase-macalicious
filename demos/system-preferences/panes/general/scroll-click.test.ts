import { afterEach, describe, expect, it } from "vitest";
import { clearScrollClick, followScrollClick, SCROLL_CLICK_KEY } from "./scroll-click";

/** A scroller as the library's ScrollView draws it, its knob at the top of its track. */
function scrollView(orientation: "vertical" | "horizontal") {
  document.body.innerHTML = `<div>
    <div class="mac-scroll-view-viewport"></div>
    <div class="mac-scroll-view-scroller" data-orientation="${orientation}">
      <div class="mac-scroll-view-knob"></div>
    </div>
  </div>`;
  const viewport = document.querySelector<HTMLElement>(".mac-scroll-view-viewport");
  const scroller = document.querySelector<HTMLElement>(".mac-scroll-view-scroller");
  const knob = document.querySelector<HTMLElement>(".mac-scroll-view-knob");
  if (!viewport || !scroller || !knob) throw new Error("no scroll view");
  Object.defineProperty(viewport, "clientHeight", { value: 200 });
  Object.defineProperty(viewport, "clientWidth", { value: 300 });
  knob.getBoundingClientRect = () => new DOMRect(0, 0, 50, 50);
  return { viewport, scroller, knob };
}

const press = (target: Element, init: PointerEventInit) => {
  const event = new MouseEvent("pointerdown", { bubbles: true, cancelable: true, ...init });
  let reached = false;
  document.body.addEventListener("pointerdown", () => {
    reached = true;
  });
  target.dispatchEvent(event);
  return reached;
};

describe("Click in the scroll bar", () => {
  afterEach(clearScrollClick);

  it("jumps by the page, toward the press, and keeps the press from the scroll view", () => {
    const { viewport, scroller } = scrollView("vertical");
    followScrollClick({});
    expect(press(scroller, { clientY: 120 })).toBe(false);
    expect(viewport.scrollTop).toBe(200);
  });

  it("pages across a horizontal scroller", () => {
    const { viewport, scroller } = scrollView("horizontal");
    followScrollClick({ [SCROLL_CLICK_KEY]: "page" });
    press(scroller, { clientX: 120 });
    expect(viewport.scrollLeft).toBe(300);
  });

  it("leaves a press on the knob, and everything under Jump to the spot, to the scroll view", () => {
    const { viewport, scroller, knob } = scrollView("vertical");
    followScrollClick({});
    expect(press(knob, { clientY: 10 })).toBe(true);
    expect(viewport.scrollTop).toBe(0);
    followScrollClick({ [SCROLL_CLICK_KEY]: "spot" });
    expect(press(scroller, { clientY: 120 })).toBe(true);
    expect(viewport.scrollTop).toBe(0);
  });
});
