/**
 * Mouse's "Scroll direction: Natural" on the served desktop. A page sees the direction the computer
 * sends and cannot tell a mouse from a trackpad, so on leaves that as it is, and off reverses it in
 * this desktop's own scrolling views. An application that reads the wheel itself and takes it (Maps)
 * keeps its own direction.
 */
const KEY = "mouse.naturalScrolling";
const LINE_PIXELS = 16;

function scrollsBy(element: Element, axis: "x" | "y", by: number): boolean {
  const style = getComputedStyle(element);
  if (!/auto|scroll/.test(axis === "y" ? style.overflowY : style.overflowX)) return false;
  const [position, size, view] =
    axis === "y"
      ? [element.scrollTop, element.scrollHeight, element.clientHeight]
      : [element.scrollLeft, element.scrollWidth, element.clientWidth];
  return by > 0 ? position + view < size - 1 : position > 0;
}

function scroll(from: Element, axis: "x" | "y", by: number) {
  if (by === 0) return;
  for (let element: Element | null = from; element; element = element.parentElement) {
    if (!scrollsBy(element, axis, by)) continue;
    if (axis === "y") element.scrollTop += by;
    else element.scrollLeft += by;
    return;
  }
}

function onWheel(event: WheelEvent) {
  // Control is the browser's pinch and zoom; a prevented wheel was an application's own.
  if (event.defaultPrevented || event.ctrlKey || !(event.target instanceof Element)) return;
  event.preventDefault();
  const unit =
    event.deltaMode === WheelEvent.DOM_DELTA_LINE
      ? LINE_PIXELS
      : event.deltaMode === WheelEvent.DOM_DELTA_PAGE
        ? window.innerHeight
        : 1;
  // Shift turns a wheel with one axis sideways.
  const sideways = event.shiftKey && event.deltaX === 0;
  scroll(event.target, "x", -(sideways ? event.deltaY : event.deltaX) * unit);
  if (!sideways) scroll(event.target, "y", -event.deltaY * unit);
}

let reversed = false;

/** Follow what the settings say. */
export function followScrollDirection(values: Readonly<Record<string, unknown>>): void {
  const next = values[KEY] === false;
  if (next === reversed) return;
  reversed = next;
  if (next) window.addEventListener("wheel", onWheel, { passive: false });
  else window.removeEventListener("wheel", onWheel);
}

/** Stop, when the person's session ends. */
export function clearScrollDirection(): void {
  followScrollDirection({});
}
