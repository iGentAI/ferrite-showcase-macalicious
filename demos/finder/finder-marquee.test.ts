import { afterEach, describe, expect, it, vi } from "vitest";
import { beginMarquee } from "./finder-marquee";

const pointer = (type: string, x: number, y: number) =>
  new PointerEvent(type, { pointerId: 1, clientX: x, clientY: y, bubbles: true });

/** An element whose box is the given one. */
function box(left: number, top: number, right: number, bottom: number) {
  const element = document.createElement("div");
  element.getBoundingClientRect = () => new DOMRect(left, top, right - left, bottom - top);
  return element;
}

afterEach(() => document.body.replaceChildren());

function start(kept: readonly string[] = [], before: readonly string[] = kept) {
  const container = box(0, 0, 500, 500);
  document.body.append(container);
  const onChange = vi.fn();
  beginMarquee(pointer("pointerdown", 10, 10), {
    container,
    kept,
    before,
    onChange,
    items: () => [
      { path: "/a", element: box(20, 20, 60, 60) },
      { path: "/b", element: box(100, 20, 140, 60) },
      { path: "/c", element: box(20, 200, 60, 240) },
    ],
  });
  return { container, onChange };
}

describe("the rubber band", () => {
  it("does nothing for a press that does not move", () => {
    const { container, onChange } = start();
    window.dispatchEvent(pointer("pointermove", 11, 11));
    window.dispatchEvent(pointer("pointerup", 11, 11));
    expect(onChange).not.toHaveBeenCalled();
    expect(container.querySelector(".mac-finder-marquee")).toBeNull();
  });

  it("selects what it touches as it grows and shrinks, and goes when let go", () => {
    const { container, onChange } = start();
    window.dispatchEvent(pointer("pointermove", 30, 30));
    expect(onChange).toHaveBeenLastCalledWith(["/a"]);
    window.dispatchEvent(pointer("pointermove", 120, 30));
    expect(onChange).toHaveBeenLastCalledWith(["/a", "/b"]);
    const band = container.querySelector<HTMLElement>(".mac-finder-marquee");
    expect([band?.style.left, band?.style.top, band?.style.width, band?.style.height]).toEqual([
      "10px",
      "10px",
      "110px",
      "20px",
    ]);
    window.dispatchEvent(pointer("pointermove", 30, 30));
    expect(onChange).toHaveBeenLastCalledWith(["/a"]);
    window.dispatchEvent(pointer("pointerup", 30, 30));
    expect(container.querySelector(".mac-finder-marquee")).toBeNull();
  });

  it("tells a change once", () => {
    const { onChange } = start();
    window.dispatchEvent(pointer("pointermove", 30, 30));
    window.dispatchEvent(pointer("pointermove", 31, 31));
    expect(onChange).toHaveBeenCalledTimes(1);
    window.dispatchEvent(pointer("pointerup", 31, 31));
  });

  it("adds to what was kept", () => {
    const { onChange } = start(["/c"]);
    window.dispatchEvent(pointer("pointermove", 30, 30));
    expect(onChange).toHaveBeenLastCalledWith(["/c", "/a"]);
    window.dispatchEvent(pointer("pointerup", 30, 30));
  });

  it("puts the selection back at Escape, and the release does nothing more", () => {
    const { container, onChange } = start([], ["/c"]);
    window.dispatchEvent(pointer("pointermove", 30, 30));
    expect(onChange).toHaveBeenLastCalledWith(["/a"]);
    window.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape" }));
    expect(onChange).toHaveBeenLastCalledWith(["/c"]);
    expect(container.querySelector(".mac-finder-marquee")).toBeNull();
    const calls = onChange.mock.calls.length;
    window.dispatchEvent(pointer("pointermove", 120, 30));
    expect(onChange).toHaveBeenCalledTimes(calls);
  });
});
