import { describe, expect, it } from "vitest";
import { familyRenders, firstFamily } from "./font-family-check";

/**
 * A document whose canvas measures text by the font it is set in: a family in `present` has a
 * width of its own; any other falls back, measuring as its fallback.
 */
function documentWith(present: readonly string[], userAgent = "Mozilla/5.0") {
  const context = {
    font: "",
    measureText() {
      const named = present.find((name) => this.font.includes(`"${name}"`));
      // The fallback is the font's last word: "72px monospace", or '72px "Optima", monospace'.
      const fallback = this.font.split(/[\s,]+/).at(-1) ?? this.font;
      return { width: named ? 100 + named.length : fallback.length };
    },
  };
  return {
    defaultView: { navigator: { userAgent } },
    createElement: () => ({ getContext: () => context }),
  } as unknown as Document;
}

describe("firstFamily", () => {
  it("reads the first family of a CSS font-family list, without its quotes", () => {
    expect(firstFamily('"Times New Roman", Times, serif')).toBe("Times New Roman");
    expect(firstFamily("Georgia, serif")).toBe("Georgia");
    expect(firstFamily("'Gill Sans', sans-serif")).toBe("Gill Sans");
    expect(firstFamily("system-ui")).toBe("system-ui");
  });
});

describe("familyRenders", () => {
  it("says a family renders when its text measures otherwise than its fallback, and not when it does not", () => {
    const document = documentWith(["Helvetica"]);
    expect(familyRenders("Helvetica", document)).toBe(true);
    expect(familyRenders("Optima", document)).toBe(false);
  });

  it("counts generic families and system keywords as rendering, measured or not", () => {
    const document = documentWith([]);
    for (const name of ["serif", "sans-serif", "monospace", "system-ui", "-apple-system"]) {
      expect(familyRenders(name, document)).toBe(true);
    }
  });

  it("cannot tell without a canvas, or without layout (jsdom)", () => {
    const noCanvas = {
      defaultView: { navigator: { userAgent: "Mozilla/5.0" } },
      createElement: () => ({ getContext: () => null }),
    } as unknown as Document;
    expect(familyRenders("Optima", noCanvas)).toBeUndefined();
    expect(familyRenders("Optima", documentWith([], "Mozilla/5.0 (linux) jsdom/26.1.0"))).toBe(
      undefined,
    );
  });
});
