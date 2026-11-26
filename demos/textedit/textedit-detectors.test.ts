import { describe, expect, it } from "vitest";
import { detectedAt, detectedInView } from "./textedit-detectors";

describe("what the detectors find at a place in the text", () => {
  const text = "Call 415-555-0134 or meet at 1 Infinite Loop Way tomorrow at 5pm.";

  it("finds the run the caret or the selection touches", () => {
    expect(detectedAt(text, 8, 8)).toEqual({ text: "415-555-0134", kind: "phone" });
    expect(detectedAt(text, 32, 40)).toEqual({ text: "1 Infinite Loop Way", kind: "address" });
    expect(detectedAt(text, 52, 52)).toEqual({ text: "tomorrow at 5pm", kind: "date" });
  });

  it("finds nothing in plain words", () => {
    expect(detectedAt(text, 1, 1)).toBeNull();
    expect(detectedAt("no such thing here", 0, 18)).toBeNull();
  });

  it("reads the paragraph a selection in a rich text view is in", () => {
    const view = document.createElement("div");
    view.innerHTML = "<div>first</div><div>ring <b>415-555</b>-0134 now</div>";
    document.body.append(view);
    const bold = view.querySelector("b")?.firstChild as Text;
    document.getSelection()?.collapse(bold, 2);
    expect(detectedInView(view, null)).toEqual({ text: "415-555-0134", kind: "phone" });
    document.getSelection()?.removeAllRanges();
    view.remove();
  });

  it("reads the line of a plain text view", () => {
    const view = document.createElement("textarea");
    view.value = "nothing\nOn March 3, 2026 we go\nnothing";
    document.body.append(view);
    view.setSelectionRange(14, 14);
    expect(detectedInView(view, null)).toEqual({ text: "March 3, 2026", kind: "date" });
    view.remove();
  });
});
