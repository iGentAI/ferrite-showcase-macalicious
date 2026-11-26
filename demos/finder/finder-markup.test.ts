import { describe, expect, it } from "vitest";
import { type Annotation, cropArea, paintMarks } from "./finder-markup";

/** A stand-in for a canvas's context, which jsdom has none of: it records what is drawn. */
function recorder() {
  const calls: unknown[][] = [];
  const call =
    (name: string) =>
    (...args: unknown[]) => {
      calls.push([name, ...args]);
    };
  return {
    calls,
    context: {
      beginPath: call("beginPath"),
      moveTo: call("moveTo"),
      lineTo: call("lineTo"),
      rect: call("rect"),
      ellipse: call("ellipse"),
      stroke: call("stroke"),
      fill: call("fill"),
      fillText: call("fillText"),
    } as unknown as CanvasRenderingContext2D,
  };
}

describe("paintMarks", () => {
  it("draws a stroke, a filled rectangle and a text where the panel showed them", () => {
    const { calls, context } = recorder();
    const marks: Annotation[] = [
      {
        id: 1,
        type: "stroke",
        points: ["100 200", "500 500"],
        color: "#f00",
        width: 2,
        opacity: 1,
      },
      { id: 2, type: "rectangle", offset: 40, color: "#000", fill: "#fff", width: 3 },
      { id: 3, type: "text", offset: 0, text: "Surf", color: "#000", size: 28 },
    ];
    paintMarks(context, marks, 2000, 1000, 2);
    expect(calls).toEqual([
      ["beginPath"],
      ["moveTo", 200, 200],
      ["lineTo", 1000, 500],
      ["stroke"],
      ["beginPath"],
      ["rect", 780, 390, 600, 300],
      ["fill"],
      ["stroke"],
      ["fillText", "Surf", 1000, 500],
    ]);
    expect(context.font).toBe("56px sans-serif");
    expect(context.lineWidth).toBe(6);
  });

  it("draws a press without a move as a line to itself", () => {
    const { calls, context } = recorder();
    paintMarks(
      context,
      [{ id: 1, type: "stroke", points: ["500 500"], color: "#000", width: 2, opacity: 0.5 }],
      100,
      100,
      1,
    );
    expect(calls.slice(1, 3)).toEqual([
      ["moveTo", 50, 50],
      ["lineTo", 50, 50],
    ]);
    expect(context.globalAlpha).toBe(0.5);
  });
});

describe("cropArea", () => {
  it("is the last crop in pixels, whichever way it was dragged", () => {
    const marks: Annotation[] = [
      { id: 1, type: "crop", from: [0, 0], to: [100, 100] },
      { id: 2, type: "crop", from: [750, 500], to: [250, 100] },
    ];
    expect(cropArea(marks, 2000, 1000)).toEqual({ left: 500, top: 100, width: 1000, height: 400 });
  });

  it("is nothing without a crop, and a press keeps one pixel", () => {
    expect(cropArea([], 100, 100)).toBeNull();
    expect(cropArea([{ id: 1, type: "crop", from: [500, 500], to: [500, 500] }], 100, 100)).toEqual(
      { left: 50, top: 50, width: 1, height: 1 },
    );
  });
});
