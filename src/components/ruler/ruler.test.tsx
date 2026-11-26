import { fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { createRef, useState } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { Ruler, type RulerMarker, type RulerProps } from "./index";

/**
 * jsdom has no layout. Stand-in: every element is 400 pt wide, which is where the ruler ends
 * for a marker (the observed width is never reported in jsdom, so the count of numbers stays
 * at the first guess). Real layout, the observed width and dragging with pointer capture are
 * exercised in Chromium by visual/output/b7/browser/ruler.mjs, and focus and the arrow keys
 * by the `expect` comparisons of ruler.visual.json.
 */
beforeEach(() => {
  vi.spyOn(Element.prototype, "clientWidth", "get").mockReturnValue(400);
});

const START: RulerMarker[] = [
  { type: "first-line-indent", position: 0 },
  { type: "left", position: 72 },
  { type: "decimal", position: 144, label: "Price column" },
];

/** A ruler whose markers are kept in state, as an application would. */
function Editable({
  initial = START,
  onMarkersChange,
  ...props
}: RulerProps & { initial?: RulerMarker[] }) {
  const [markers, setMarkers] = useState(initial);
  return (
    <Ruler
      aria-label="Ruler"
      markers={markers}
      onMarkersChange={(next) => {
        setMarkers(next);
        onMarkersChange?.(next);
      }}
      {...props}
    />
  );
}

const slider = (name: string) => screen.getByRole("slider", { name });
const root = (container: HTMLElement) => container.firstElementChild as HTMLElement;

describe("Ruler", () => {
  it("is a decorative strip in inches from an origin of 5 pt by default", () => {
    const { container } = render(<Ruler />);
    const ruler = root(container);
    expect(ruler).toHaveClass("mac-ruler");
    expect(ruler).toHaveAttribute("aria-hidden", "true");
    expect(ruler).not.toHaveAttribute("role");
    expect(ruler).toHaveAttribute("data-units", "inches");
    expect(ruler.style.getPropertyValue("--_origin")).toBe("5px");
    expect(ruler.style.getPropertyValue("--_major")).toBe("72px");
    expect(screen.queryByRole("slider")).toBeNull();
    // Numbers are text, one per inch, 3 pt after their tick (the digit's ink starts at 3.5).
    expect(screen.getByText("0").style.left).toBe("8px");
    expect(screen.getByText("1").style.left).toBe("80px");
    expect(screen.getByText("8").style.left).toBe(`${5 + 8 * 72 + 3}px`);
  });

  it("measures from the origin it is given", () => {
    const { container } = render(<Ruler origin={40} markers={[{ type: "left", position: 72 }]} />);
    expect(root(container).style.getPropertyValue("--_origin")).toBe("40px");
    expect(screen.getByText("0").style.left).toBe("43px");
    expect(container.querySelector<HTMLElement>(".mac-ruler-marker")?.style.left).toBe("112px");
  });

  it.each([
    ["centimeters", "28.3465px", ["0", "1", "2"]],
    ["points", "100px", ["0", "100", "200"]],
    ["picas", "120px", ["0", "10", "20"]],
  ] as const)("numbers a ruler in %s", (units, major, numbers) => {
    const { container } = render(<Ruler units={units} />);
    const ruler = root(container);
    expect(ruler).toHaveAttribute("data-units", units);
    expect(ruler.style.getPropertyValue("--_major")).toBe(major);
    const shown = [...container.querySelectorAll(".mac-ruler-number")].map((n) => n.textContent);
    expect(shown.slice(0, 3)).toEqual(numbers);
    const second = container.querySelectorAll<HTMLElement>(".mac-ruler-number")[1];
    expect(Number.parseFloat(second?.style.left ?? "")).toBeCloseTo(
      5 + Number.parseFloat(major) + 3,
    );
  });

  it("draws markers that cannot be operated when there is no change handler", async () => {
    const user = userEvent.setup();
    const { container } = render(<Ruler markers={START} />);
    const markers = [...container.querySelectorAll<HTMLElement>(".mac-ruler-marker")];
    expect(markers.map((marker) => marker.dataset.type)).toEqual([
      "first-line-indent",
      "left",
      "decimal",
    ]);
    expect(markers.map((marker) => marker.style.left)).toEqual(["5px", "77px", "149px"]);
    for (const marker of markers) {
      expect(marker).not.toHaveAttribute("role");
      expect(marker).not.toHaveAttribute("tabindex");
    }
    await user.tab();
    expect(document.body).toHaveFocus();
  });

  it("makes the markers sliders, named and valued, when it has a change handler", () => {
    render(<Editable />);
    expect(screen.getByRole("group", { name: "Ruler" })).not.toHaveAttribute("aria-hidden");
    expect(screen.getAllByRole("slider")).toHaveLength(3);
    expect(slider("first line indent")).toHaveAttribute("aria-valuenow", "0");
    const tab = slider("left tab stop");
    expect(tab).toHaveAttribute("aria-valuenow", "72");
    expect(tab).toHaveAttribute("aria-valuemin", "0");
    // The largest value is a tick a marker can reach: a whole number of 9 pt steps.
    const max = Number(tab.getAttribute("aria-valuemax"));
    expect(max).toBeGreaterThan(72);
    expect(max % 9).toBe(0);
    expect(tab).toHaveAttribute("aria-valuetext", "1 in");
    expect(tab).toHaveAttribute("tabindex", "0");
    expect(slider("Price column")).toHaveAttribute("aria-valuetext", "2 in");
  });

  it("gives the value in the ruler's units", () => {
    render(<Editable units="picas" initial={[{ type: "right", position: 90 }]} />);
    expect(slider("right tab stop")).toHaveAttribute("aria-valuetext", "7.5 pc");
  });

  it("moves the focused marker one tick with the arrow keys, and to the ends with Home and End", async () => {
    const user = userEvent.setup();
    const onMarkersChange = vi.fn();
    render(<Editable onMarkersChange={onMarkersChange} />);
    await user.tab();
    await user.tab();
    const tab = slider("left tab stop");
    expect(tab).toHaveFocus();
    await user.keyboard("{ArrowRight}");
    expect(tab).toHaveAttribute("aria-valuenow", "81");
    expect(tab.style.left).toBe("86px");
    // Only the moved marker is a new object.
    const next = onMarkersChange.mock.lastCall?.[0] as RulerMarker[];
    expect(next).toEqual([START[0], { type: "left", position: 81 }, START[2]]);
    expect(next[0]).toBe(START[0]);
    await user.keyboard("{ArrowUp}");
    expect(tab).toHaveAttribute("aria-valuenow", "90");
    await user.keyboard("{ArrowLeft}{ArrowDown}{ArrowLeft}");
    expect(tab).toHaveAttribute("aria-valuenow", "63");
    await user.keyboard("{Home}");
    expect(tab).toHaveAttribute("aria-valuenow", "0");
    onMarkersChange.mockClear();
    await user.keyboard("{ArrowLeft}{Home}a");
    expect(onMarkersChange).not.toHaveBeenCalled();
    // The last tick inside a 400 pt ruler whose origin is at 5.
    await user.keyboard("{End}");
    expect(tab).toHaveAttribute("aria-valuenow", "387");
    await user.keyboard("{ArrowRight}");
    expect(tab).toHaveAttribute("aria-valuenow", "387");
    expect(tab).toHaveFocus();
  });

  it("snaps a marker that is between ticks to a tick when it moves", async () => {
    const user = userEvent.setup();
    render(<Editable initial={[{ type: "tail-indent", position: 380 }]} />);
    await user.tab();
    await user.keyboard("{ArrowLeft}");
    expect(slider("tail indent")).toHaveAttribute("aria-valuenow", "369");
  });

  it("steps by the smallest tick of its units", async () => {
    const user = userEvent.setup();
    render(<Editable units="points" initial={[{ type: "center", position: 100 }]} />);
    await user.tab();
    await user.keyboard("{ArrowRight}");
    expect(slider("center tab stop")).toHaveAttribute("aria-valuenow", "112.5");
  });

  it("follows the pointer while a marker is dragged, by ticks", () => {
    render(<Editable />);
    const tab = slider("left tab stop");
    fireEvent.pointerDown(tab, { button: 0, clientX: 80, pointerId: 1 });
    expect(tab).toHaveAttribute("aria-valuenow", "72");
    fireEvent.pointerMove(tab, { clientX: 83, pointerId: 1 });
    expect(tab).toHaveAttribute("aria-valuenow", "72");
    fireEvent.pointerMove(tab, { clientX: 100, pointerId: 1 });
    expect(tab).toHaveAttribute("aria-valuenow", "90");
    fireEvent.pointerMove(tab, { clientX: 900, pointerId: 1 });
    expect(tab).toHaveAttribute("aria-valuenow", "387");
    fireEvent.pointerMove(tab, { clientX: -500, pointerId: 1 });
    expect(tab).toHaveAttribute("aria-valuenow", "0");
    fireEvent.lostPointerCapture(tab, { pointerId: 1 });
    fireEvent.pointerMove(tab, { clientX: 100, pointerId: 1 });
    expect(tab).toHaveAttribute("aria-valuenow", "0");
    expect(slider("first line indent")).toHaveAttribute("aria-valuenow", "0");
    expect(slider("Price column")).toHaveAttribute("aria-valuenow", "144");
  });

  it("moves a marker with the pointer when the ruler is magnified", () => {
    render(<Editable zoom={2} />);
    const tab = slider("left tab stop");
    fireEvent.pointerDown(tab, { button: 0, clientX: 160, pointerId: 1 });
    fireEvent.pointerMove(tab, { clientX: 196, pointerId: 1 });
    expect(tab).toHaveAttribute("aria-valuenow", "90");
  });

  it("lets only the pointer that started a drag move the marker or end the drag", () => {
    render(<Editable />);
    const tab = slider("left tab stop");
    fireEvent.pointerDown(tab, { button: 0, clientX: 80, pointerId: 1 });
    fireEvent.pointerMove(tab, { clientX: 200, pointerId: 2 });
    expect(tab).toHaveAttribute("aria-valuenow", "72");
    fireEvent.pointerDown(tab, { button: 0, clientX: 200, pointerId: 2 });
    fireEvent.lostPointerCapture(tab, { pointerId: 2 });
    fireEvent.lostPointerCapture(tab, { pointerId: 2 });
    fireEvent.pointerMove(tab, { clientX: 100, pointerId: 1 });
    expect(tab).toHaveAttribute("aria-valuenow", "90");
    fireEvent.lostPointerCapture(tab, { pointerId: 1 });
    fireEvent.pointerMove(tab, { clientX: 150, pointerId: 1 });
    expect(tab).toHaveAttribute("aria-valuenow", "90");
  });

  it("does not drag with another mouse button, after a cancelled drag, or from the strip", () => {
    const onMarkersChange = vi.fn();
    render(<Editable onMarkersChange={onMarkersChange} />);
    const tab = slider("left tab stop");
    fireEvent.pointerDown(tab, { button: 2, clientX: 80, pointerId: 1 });
    fireEvent.pointerMove(tab, { clientX: 120, pointerId: 1 });
    fireEvent.pointerDown(tab, { button: 0, clientX: 80, pointerId: 1 });
    fireEvent.lostPointerCapture(tab, { pointerId: 1 });
    fireEvent.pointerMove(tab, { clientX: 120, pointerId: 1 });
    const strip = screen.getByRole("group");
    fireEvent.pointerDown(strip, { button: 0, clientX: 80, pointerId: 1 });
    fireEvent.pointerMove(strip, { clientX: 120, pointerId: 1 });
    expect(onMarkersChange).not.toHaveBeenCalled();
  });

  it("runs the caller's handlers first and lets them cancel", async () => {
    const user = userEvent.setup();
    const onMarkersChange = vi.fn();
    const onKeyDown = vi.fn((event: React.KeyboardEvent) => event.preventDefault());
    const onPointerDown = vi.fn((event: React.PointerEvent) => event.preventDefault());
    render(
      <Editable
        onMarkersChange={onMarkersChange}
        onKeyDown={onKeyDown}
        onPointerDown={onPointerDown}
      />,
    );
    await user.tab();
    await user.keyboard("{ArrowRight}");
    expect(onKeyDown).toHaveBeenCalledTimes(1);
    const tab = slider("left tab stop");
    fireEvent.pointerDown(tab, { button: 0, clientX: 80, pointerId: 1 });
    fireEvent.pointerMove(tab, { clientX: 120, pointerId: 1 });
    expect(onPointerDown).toHaveBeenCalledTimes(1);
    expect(onMarkersChange).not.toHaveBeenCalled();
  });

  it("forwards ref, className, style and attributes to the strip", () => {
    const ref = createRef<HTMLDivElement>();
    render(<Ruler ref={ref} className="extra" id="ruler" style={{ width: 300 }} data-kind="x" />);
    expect(ref.current).toHaveClass("mac-ruler", "extra");
    expect(ref.current).toHaveAttribute("id", "ruler");
    expect(ref.current).toHaveAttribute("data-kind", "x");
    expect(ref.current?.style.width).toBe("300px");
    expect(ref.current?.style.getPropertyValue("--_origin")).toBe("5px");
  });
});
