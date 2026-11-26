import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { createRef } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { CalculatorKeypad, CalculatorKeypadDisplay, CalculatorKeypadKey } from "./index";

describe("CalculatorKeypad", () => {
  it("renders a labelled group that holds the display and the keys", () => {
    render(
      <CalculatorKeypad aria-label="Calculator">
        <CalculatorKeypadDisplay aria-label="Result">42</CalculatorKeypadDisplay>
        <CalculatorKeypadKey>7</CalculatorKeypadKey>
      </CalculatorKeypad>,
    );
    const group = screen.getByRole("group", { name: "Calculator" });
    expect(group).toHaveClass("mac-calculator-keypad");
    expect(group).toContainElement(screen.getByRole("status", { name: "Result" }));
    expect(group).toContainElement(screen.getByRole("button", { name: "7" }));
  });

  it("merges className and forwards props and ref", () => {
    const ref = createRef<HTMLDivElement>();
    render(<CalculatorKeypad ref={ref} className="mine" id="pad" data-x="1" />);
    const group = screen.getByRole("group");
    expect(ref.current).toBe(group);
    expect(group).toHaveClass("mac-calculator-keypad", "mine");
    expect(group).toHaveAttribute("id", "pad");
    expect(group).toHaveAttribute("data-x", "1");
  });
});

describe("CalculatorKeypadDisplay", () => {
  it("is an output with the value as its text", () => {
    const ref = createRef<HTMLOutputElement>();
    render(
      <CalculatorKeypadDisplay ref={ref} className="mine" aria-label="Result">
        3.14
      </CalculatorKeypadDisplay>,
    );
    const display = screen.getByRole("status", { name: "Result" });
    expect(display.tagName).toBe("OUTPUT");
    expect(display).toHaveTextContent("3.14");
    expect(display).toHaveClass("mac-calculator-keypad-display", "mine");
    expect(ref.current).toBe(display);
  });

  it("keeps the full size up to fitLength characters and scales longer text down", () => {
    const { rerender } = render(<CalculatorKeypadDisplay>1234567</CalculatorKeypadDisplay>);
    const display = screen.getByRole("status");
    expect(display.style.getPropertyValue("--_scale")).toBe("");

    rerender(<CalculatorKeypadDisplay>12345678901234</CalculatorKeypadDisplay>);
    expect(display.style.getPropertyValue("--_scale")).toBe("0.5");

    rerender(<CalculatorKeypadDisplay fitLength={4}>{12345678}</CalculatorKeypadDisplay>);
    expect(display.style.getPropertyValue("--_scale")).toBe("0.5");

    rerender(
      <CalculatorKeypadDisplay fitLength={4} style={{ opacity: 0.5 }}>
        12345678
      </CalculatorKeypadDisplay>,
    );
    expect(display.style.getPropertyValue("--_scale")).toBe("0.5");
    expect(display).toHaveStyle({ opacity: "0.5" });
  });

  describe("where the browser lays it out", () => {
    afterEach(() => {
      vi.restoreAllMocks();
    });

    /**
     * jsdom has no layout: stand in for a display `displayWidth()` pt wide and for text that
     * is `fullWidth()` wide at the full size and proportionally narrower when scaled. `zoom`
     * is the scale of an ancestor's transform, which only the rectangles include.
     */
    function layOut(fullWidth: () => number, displayWidth = () => 200, zoom = 1) {
      vi.spyOn(HTMLElement.prototype, "clientWidth", "get").mockImplementation(displayWidth);
      vi.spyOn(HTMLElement.prototype, "offsetWidth", "get").mockImplementation(displayWidth);
      vi.spyOn(HTMLElement.prototype, "getBoundingClientRect").mockImplementation(function (
        this: HTMLElement,
      ) {
        if (this.tagName === "OUTPUT") return { width: displayWidth() * zoom } as DOMRect;
        const scale = Number(this.parentElement?.style.getPropertyValue("--_scale")) || 1;
        return { width: fullWidth() * scale * zoom } as DOMRect;
      });
    }

    it("scales text that is wider than the display down to its width, whatever its length", () => {
      let width = 400;
      layOut(() => width);
      const { rerender } = render(<CalculatorKeypadDisplay>8888888</CalculatorKeypadDisplay>);
      const display = screen.getByRole("status");
      // Seven characters pass the estimate, but in this font they are twice the display.
      expect(display.style.getPropertyValue("--_scale")).toBe("0.5");

      // Shorter text that fits: back to the full size.
      width = 80;
      rerender(<CalculatorKeypadDisplay>42</CalculatorKeypadDisplay>);
      expect(display.style.getPropertyValue("--_scale")).toBe("");
    });

    it("corrects the estimate when the text is narrower than it assumes", () => {
      // Fourteen narrow characters, 160 pt at the full size: the estimate would halve them.
      layOut(() => 160);
      render(<CalculatorKeypadDisplay>11111111111111</CalculatorKeypadDisplay>);
      expect(screen.getByRole("status").style.getPropertyValue("--_scale")).toBe("");
    });

    it("measures in the display's own points under an ancestor scaled by a transform", () => {
      // Twice the display at the full size, and everything drawn at twice its size.
      layOut(
        () => 400,
        () => 200,
        2,
      );
      render(<CalculatorKeypadDisplay>8888888</CalculatorKeypadDisplay>);
      expect(screen.getByRole("status").style.getPropertyValue("--_scale")).toBe("0.5");
    });

    it("fits the text again when the display is resized or a font finishes loading", () => {
      const resized: (() => void)[] = [];
      const disconnect = vi.fn();
      vi.stubGlobal(
        "ResizeObserver",
        class {
          constructor(callback: () => void) {
            resized.push(callback);
          }
          observe() {}
          disconnect = disconnect;
        },
      );
      const fonts = new EventTarget();
      const removeEventListener = vi.spyOn(fonts, "removeEventListener");
      Object.defineProperty(document, "fonts", { value: fonts, configurable: true });
      try {
        let text = 400;
        let width = 200;
        layOut(
          () => text,
          () => width,
        );
        const { unmount } = render(<CalculatorKeypadDisplay>8888888</CalculatorKeypadDisplay>);
        const display = screen.getByRole("status");
        expect(display.style.getPropertyValue("--_scale")).toBe("0.5");

        // The display becomes half as wide, with no render.
        width = 100;
        for (const callback of resized) callback();
        expect(display.style.getPropertyValue("--_scale")).toBe("0.25");

        // A narrower font replaces the fallback.
        text = 200;
        fonts.dispatchEvent(new Event("loadingdone"));
        expect(display.style.getPropertyValue("--_scale")).toBe("0.5");

        unmount();
        expect(disconnect).toHaveBeenCalledTimes(1);
        expect(removeEventListener).toHaveBeenCalledWith("loadingdone", expect.any(Function));
      } finally {
        Reflect.deleteProperty(document, "fonts");
        vi.unstubAllGlobals();
      }
    });
  });
});

describe("CalculatorKeypadKey", () => {
  it("is a digit key by default, named by its text", () => {
    render(<CalculatorKeypadKey>7</CalculatorKeypadKey>);
    const key = screen.getByRole("button", { name: "7" });
    expect(key).toHaveClass("mac-calculator-keypad-key");
    expect(key).toHaveAttribute("data-variant", "digit");
    expect(key).toHaveAttribute("type", "button");
    expect(key).not.toHaveAttribute("aria-pressed");
    expect(key).not.toHaveAttribute("data-glyph");
  });

  it("reflects the variant", () => {
    render(
      <>
        <CalculatorKeypadKey variant="function">%</CalculatorKeypadKey>
        <CalculatorKeypadKey variant="operator">=</CalculatorKeypadKey>
      </>,
    );
    expect(screen.getByRole("button", { name: "%" })).toHaveAttribute("data-variant", "function");
    expect(screen.getByRole("button", { name: "=" })).toHaveAttribute("data-variant", "operator");
  });

  it.each([
    ["add", "Add"],
    ["subtract", "Subtract"],
    ["multiply", "Multiply"],
    ["divide", "Divide"],
    ["equals", "Equals"],
    ["negate", "Negate"],
  ] as const)("draws the %s glyph and names the key %s", (glyph, name) => {
    render(<CalculatorKeypadKey glyph={glyph}>ignored</CalculatorKeypadKey>);
    const key = screen.getByRole("button", { name });
    expect(key).toHaveAttribute("data-glyph", glyph);
    expect(key).not.toHaveTextContent("ignored");
    expect(key.querySelector("svg")).toHaveAttribute("aria-hidden", "true");
  });

  it("lets aria-label replace the name of a glyph key", () => {
    render(<CalculatorKeypadKey glyph="negate" aria-label="Change sign" />);
    expect(screen.getByRole("button", { name: "Change sign" })).toBeInTheDocument();
  });

  it("spans grid columns", () => {
    render(
      <>
        <CalculatorKeypadKey span={2} style={{ opacity: 0.5 }}>
          0
        </CalculatorKeypadKey>
        <CalculatorKeypadKey>1</CalculatorKeypadKey>
      </>,
    );
    const wide = screen.getByRole("button", { name: "0" });
    expect(wide.style.gridColumnEnd).toBe("span 2");
    expect(wide).toHaveStyle({ opacity: "0.5" });
    expect(screen.getByRole("button", { name: "1" }).style.gridColumnEnd).toBe("");
  });

  it("keeps a style given as a function of the button's state, also on a spanning key", () => {
    render(
      <>
        <CalculatorKeypadKey
          span={2}
          disabled
          style={(state) => ({ opacity: state.disabled ? 0.25 : 1 })}
        >
          0
        </CalculatorKeypadKey>
        <CalculatorKeypadKey style={(state) => ({ opacity: state.disabled ? 0.25 : 1 })}>
          1
        </CalculatorKeypadKey>
      </>,
    );
    const wide = screen.getByRole("button", { name: "0" });
    expect(wide.style.gridColumnEnd).toBe("span 2");
    expect(wide).toHaveStyle({ opacity: "0.25" });
    expect(screen.getByRole("button", { name: "1" })).toHaveStyle({ opacity: "1" });
  });

  it("marks an armed operator as pressed", () => {
    const { rerender } = render(<CalculatorKeypadKey glyph="add" armed />);
    const key = screen.getByRole("button", { name: "Add" });
    expect(key).toHaveAttribute("aria-pressed", "true");
    expect(key).toHaveAttribute("data-armed");

    rerender(<CalculatorKeypadKey glyph="add" armed={false} />);
    expect(key).toHaveAttribute("aria-pressed", "false");
    expect(key).not.toHaveAttribute("data-armed");
  });

  it("is activated by pointer, Return and Space", async () => {
    const user = userEvent.setup();
    const onClick = vi.fn();
    render(<CalculatorKeypadKey onClick={onClick}>5</CalculatorKeypadKey>);
    const key = screen.getByRole("button", { name: "5" });

    await user.click(key);
    expect(onClick).toHaveBeenCalledTimes(1);

    await user.keyboard("{Enter}");
    expect(onClick).toHaveBeenCalledTimes(2);
    await user.keyboard(" ");
    expect(onClick).toHaveBeenCalledTimes(3);
  });

  it("is in the tab order and does nothing when disabled", async () => {
    const user = userEvent.setup();
    const onClick = vi.fn();
    render(
      <>
        <CalculatorKeypadKey disabled onClick={onClick}>
          1
        </CalculatorKeypadKey>
        <CalculatorKeypadKey>2</CalculatorKeypadKey>
      </>,
    );
    const disabled = screen.getByRole("button", { name: "1" });
    expect(disabled).toBeDisabled();
    expect(disabled).toHaveAttribute("data-disabled");
    await user.click(disabled);
    expect(onClick).not.toHaveBeenCalled();

    await user.tab();
    expect(screen.getByRole("button", { name: "2" })).toHaveFocus();
  });

  it("merges className and forwards props and ref", () => {
    const ref = createRef<HTMLElement>();
    render(
      <CalculatorKeypadKey ref={ref} className="mine" id="key" data-x="1">
        3
      </CalculatorKeypadKey>,
    );
    const key = screen.getByRole("button", { name: "3" });
    expect(ref.current).toBe(key);
    expect(key).toHaveClass("mac-calculator-keypad-key", "mine");
    expect(key).toHaveAttribute("id", "key");
    expect(key).toHaveAttribute("data-x", "1");
  });
});
