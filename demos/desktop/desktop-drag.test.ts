import { afterEach, describe, expect, it, vi } from "vitest";
import {
  beginDesktopDrag,
  type DesktopDragItem,
  type DesktopDropTarget,
  filesOfDrag,
  landingAt,
  registerDropTarget,
} from "./desktop-drag";

const FILE: DesktopDragItem = { id: "a", name: "a.png", kind: "file", type: "image/png" };
const SECOND: DesktopDragItem = { id: "b", name: "b.png", kind: "file", type: "image/png" };
const DRAG = { from: "finder", items: [FILE], copy: false };

const pointer = (type: string, x: number, y: number, init: PointerEventInit = {}) =>
  new PointerEvent(type, { pointerId: 1, clientX: x, clientY: y, bubbles: true, ...init });

const removals: (() => void)[] = [];
const target = (element: Element, landing: DesktopDropTarget["landing"]) =>
  removals.push(registerDropTarget({ element, landing }));

afterEach(() => {
  for (const remove of removals.splice(0)) remove();
  document.body.replaceChildren();
  vi.restoreAllMocks();
});

/** Two nested boxes on the page, and `document.elementFromPoint` answering `at`. */
function boxes(at?: () => Element | null) {
  const outer = document.createElement("div");
  const inner = document.createElement("div");
  outer.append(inner);
  document.body.append(outer);
  document.elementFromPoint = vi.fn(at ?? (() => inner));
  return { outer, inner };
}

describe("filesOfDrag", () => {
  it("reads a file that is not on the drive from its own bytes", async () => {
    const [file] = await filesOfDrag([
      {
        id: "/api/mail/messages/m1/attachments/a1",
        name: "chart.txt",
        kind: "file",
        type: "text/plain",
        bytes: async () => new Blob(["the chart"]),
      },
    ]);
    expect(file?.name).toBe("chart.txt");
    expect(file?.type).toBe("text/plain");
    expect(await file?.text()).toBe("the chart");
  });
});

describe("landingAt", () => {
  it("asks the innermost target first and passes up when it does not answer", () => {
    const { outer, inner } = boxes();
    const drop = () => {};
    target(outer, () => ({ element: outer, drop }));
    expect(landingAt(inner, DRAG)?.element).toBe(outer);
    target(inner, () => ({ element: inner, drop }));
    expect(landingAt(inner, DRAG)?.element).toBe(inner);
  });

  it("goes to the outer target when the inner one passes", () => {
    const { outer, inner } = boxes();
    target(outer, () => ({ element: outer, drop: () => {} }));
    target(inner, () => undefined);
    expect(landingAt(inner, DRAG)?.element).toBe(outer);
  });

  it("finds nothing outside every target, and nothing once a target is removed", () => {
    const { outer, inner } = boxes();
    expect(landingAt(inner, DRAG)).toBeUndefined();
    const remove = registerDropTarget({
      element: outer,
      landing: () => ({ element: outer, drop: () => {} }),
    });
    expect(landingAt(inner, DRAG)).toBeDefined();
    remove();
    expect(landingAt(inner, DRAG)).toBeUndefined();
    expect(landingAt(null, DRAG)).toBeUndefined();
  });
});

describe("beginDesktopDrag", () => {
  it("keeps the focus where it was while a drag is under way, and no window hears of a move", () => {
    const { inner } = boxes();
    const from = document.body.appendChild(document.createElement("input"));
    const text = document.body.appendChild(document.createElement("input"));
    const heard = vi.fn();
    document.addEventListener("focusin", heard);
    from.focus();
    heard.mockClear();
    target(inner, () => ({ element: inner, drop: () => {} }));
    beginDesktopDrag(pointer("pointerdown", 10, 10), { from: "finder", items: () => [FILE] });
    window.dispatchEvent(pointer("pointermove", 40, 40));
    text.focus();
    expect(document.activeElement).toBe(from);
    expect(heard).not.toHaveBeenCalled();
    window.dispatchEvent(pointer("pointerup", 40, 40));
    text.focus();
    expect(document.activeElement).toBe(text);
    expect(heard).toHaveBeenCalledTimes(1);
    document.removeEventListener("focusin", heard);
  });

  it("leaves the focus nowhere when nothing had it as the drag began", () => {
    const { inner } = boxes();
    const text = document.body.appendChild(document.createElement("input"));
    const heard = vi.fn();
    document.addEventListener("focusin", heard);
    target(inner, () => ({ element: inner, drop: () => {} }));
    beginDesktopDrag(pointer("pointerdown", 10, 10), { from: "finder", items: () => [FILE] });
    window.dispatchEvent(pointer("pointermove", 40, 40));
    expect(document.activeElement).toBe(document.body);
    text.focus();
    expect(document.activeElement).toBe(document.body);
    expect(heard).not.toHaveBeenCalled();
    window.dispatchEvent(pointer("pointerup", 40, 40));
    document.removeEventListener("focusin", heard);
  });

  describe("a spring-loaded target", () => {
    afterEach(() => vi.useRealTimers());

    function resting(refusal?: string) {
      vi.useFakeTimers();
      const { inner } = boxes();
      const springs = vi.fn();
      target(inner, () => ({ element: inner, refusal, springs, drop: () => {} }));
      beginDesktopDrag(pointer("pointerdown", 10, 10), { from: "finder", items: () => [FILE] });
      window.dispatchEvent(pointer("pointermove", 40, 40));
      return springs;
    }

    it("opens once when the drag rests on it, moving within it or not", () => {
      const springs = resting();
      vi.advanceTimersByTime(400);
      window.dispatchEvent(pointer("pointermove", 41, 41));
      vi.advanceTimersByTime(300);
      expect(springs).toHaveBeenCalledTimes(1);
      vi.advanceTimersByTime(2000);
      expect(springs).toHaveBeenCalledTimes(1);
      window.dispatchEvent(pointer("pointerup", 41, 41));
    });

    it("does not open when the drag leaves first, or ends", () => {
      const springs = resting();
      vi.advanceTimersByTime(400);
      document.elementFromPoint = vi.fn(() => document.body);
      window.dispatchEvent(pointer("pointermove", 90, 90));
      vi.advanceTimersByTime(2000);
      expect(springs).not.toHaveBeenCalled();
      window.dispatchEvent(pointer("pointerup", 90, 90));
    });

    it("does not open after the items are let go", () => {
      const springs = resting();
      window.dispatchEvent(pointer("pointerup", 40, 40));
      vi.advanceTimersByTime(2000);
      expect(springs).not.toHaveBeenCalled();
    });

    it("does not open a target that refuses the items", () => {
      const springs = resting("No.");
      vi.advanceTimersByTime(2000);
      expect(springs).not.toHaveBeenCalled();
      window.dispatchEvent(pointer("pointerup", 40, 40));
    });
  });
  it("does nothing for a press that does not move far enough", () => {
    const { inner } = boxes();
    const drop = vi.fn();
    target(inner, () => ({ element: inner, drop }));
    const items = vi.fn(() => [FILE]);
    beginDesktopDrag(pointer("pointerdown", 10, 10), { from: "finder", items });
    window.dispatchEvent(pointer("pointermove", 12, 12));
    window.dispatchEvent(pointer("pointerup", 12, 12));
    expect(items).not.toHaveBeenCalled();
    expect(drop).not.toHaveBeenCalled();
    expect(document.querySelector(".mac-desktop-drag")).toBeNull();
  });

  it("shows the image with a count, marks the target and drops on it", () => {
    const { inner } = boxes();
    const drop = vi.fn();
    const seen: { copy: boolean; from: string }[] = [];
    target(inner, (_hit, drag) => {
      seen.push({ copy: drag.copy, from: drag.from });
      return { element: inner, drop };
    });
    beginDesktopDrag(pointer("pointerdown", 10, 10), {
      from: "finder",
      items: () => [FILE, SECOND],
    });
    window.dispatchEvent(pointer("pointermove", 40, 40));
    expect(document.querySelector(".mac-desktop-drag-name")?.textContent).toBe("a.png");
    expect(document.querySelector(".mac-desktop-drag-count")?.textContent).toBe("2");
    expect(inner.getAttribute("data-desktop-drop")).toBe("accept");
    expect(document.documentElement.dataset.desktopDragging).toBe("");

    window.dispatchEvent(pointer("pointerup", 40, 40, { altKey: true }));
    expect(drop).toHaveBeenCalledTimes(1);
    expect(seen.at(-1)).toEqual({ copy: true, from: "finder" });
    expect(document.querySelector(".mac-desktop-drag")).toBeNull();
    expect(inner.hasAttribute("data-desktop-drop")).toBe(false);
    expect(document.documentElement.dataset.desktopDragging).toBeUndefined();
  });

  it("says the refusal instead of dropping", () => {
    const { inner } = boxes();
    const drop = vi.fn();
    const sayRefusal = vi.fn();
    target(inner, () => ({ element: inner, refusal: "No.", sayRefusal, drop }));
    beginDesktopDrag(pointer("pointerdown", 10, 10), { from: "finder", items: () => [FILE] });
    window.dispatchEvent(pointer("pointermove", 40, 40));
    expect(inner.getAttribute("data-desktop-drop")).toBe("refuse");
    window.dispatchEvent(pointer("pointerup", 40, 40));
    expect(drop).not.toHaveBeenCalled();
    expect(sayRefusal).toHaveBeenCalledWith("No.");
  });

  it("stops at Escape, and the pointer's release then drops nothing", () => {
    const { inner } = boxes();
    const drop = vi.fn();
    target(inner, () => ({ element: inner, drop }));
    beginDesktopDrag(pointer("pointerdown", 10, 10), { from: "finder", items: () => [FILE] });
    window.dispatchEvent(pointer("pointermove", 40, 40));
    window.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape" }));
    expect(document.querySelector(".mac-desktop-drag")).toBeNull();
    window.dispatchEvent(pointer("pointerup", 40, 40));
    expect(drop).not.toHaveBeenCalled();
  });

  it("tells the source when a drag has nothing to carry", () => {
    boxes();
    const onNothing = vi.fn();
    beginDesktopDrag(pointer("pointerdown", 10, 10), {
      from: "finder",
      items: () => [],
      onNothing,
    });
    window.dispatchEvent(pointer("pointermove", 40, 40));
    expect(document.querySelector(".mac-desktop-drag")).toBeNull();
    window.dispatchEvent(pointer("pointerup", 40, 40));
    expect(onNothing).toHaveBeenCalledTimes(1);
  });
});
