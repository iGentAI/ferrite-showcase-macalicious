import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Menu, MenuPopup, MenuTrigger } from "macalicious/menu";
import { afterEach, describe, expect, it, vi } from "vitest";
import { convert, readRecent, recentTitle, withRecent } from "./calculator-convert";
import {
  CalculatorConvertItems,
  ConvertSheet,
  NO_CONVERT_IN_PROGRAMMER,
  NO_CURRENCY,
} from "./calculator-convert-menu";
import { CalculatorSpeechItems, speakKey, spokenKey } from "./calculator-speech";
import { printTape, TapeSaveSheet, tapeTextLines } from "./calculator-tape-file";

const rounded = (value: number) => Number(value.toPrecision(12));

describe("convert", () => {
  it.each([
    ["length", 1, "Inches", "Centimeters", 2.54],
    ["length", 1, "Miles", "Kilometers", 1.609344],
    ["length", 1, "Nautical Miles", "Meters", 1852],
    ["area", 1, "Hectares", "Acres", 2.47105381467],
    ["energy", 1, "Kilowatt-Hours", "Joules", 3_600_000],
    ["energy", 1, "Kilogram-Calories", "Calories", 1000],
    ["speed", 100, "Kilometers per Hour", "Miles per Hour", 62.1371192237],
    ["speed", 1, "Knots", "Kilometers per Hour", 1.852],
    ["pressure", 1, "Atmospheres", "Pascals", 101_325],
    ["pressure", 1, "Atmospheres", "Pounds per Square Inch", 14.6959487755],
    ["mass", 1, "Pounds", "Ounces", 16],
    ["mass", 1, "Stones", "Pounds", 14],
    ["power", 1, "Horsepower", "Watts", 745.699871582],
    ["volume", 1, "Gallons", "Quarts", 4],
    ["volume", 1, "Cups", "Tablespoons", 16],
    ["temperature", 100, "Celsius", "Fahrenheit", 212],
    ["temperature", 32, "Fahrenheit", "Kelvin", 273.15],
    ["temperature", 0, "Kelvin", "Celsius", -273.15],
  ] as const)("%s: %s %s is %s in %s", (category, value, from, to, expected) => {
    expect(rounded(convert(category, value, from, to))).toBe(expected);
  });
});

describe("recent conversions", () => {
  const length = { category: "length", from: "Feet", to: "Meters" } as const;
  const mass = { category: "mass", from: "Pounds", to: "Grams" } as const;

  it("puts the newest first, each once, and keeps five", () => {
    expect(withRecent([length, mass], mass)).toEqual([mass, length]);
    let recent = withRecent([], length);
    for (const to of ["Inches", "Yards", "Miles", "Kilometers", "Centimeters"]) {
      recent = withRecent(recent, { ...length, to });
    }
    expect(recent.map(recentTitle)).toEqual([
      "Length: Feet to Centimeters",
      "Length: Feet to Kilometers",
      "Length: Feet to Miles",
      "Length: Feet to Yards",
      "Length: Feet to Inches",
    ]);
  });

  it("reads back only conversions that exist", () => {
    expect(readRecent("nope")).toBeUndefined();
    expect(
      readRecent([length, { category: "length", from: "Feet", to: "Grams" }, { category: "x" }, 3]),
    ).toEqual([length]);
  });
});

function menu(children: React.ReactNode) {
  return (
    <Menu defaultOpen>
      <MenuTrigger>Open</MenuTrigger>
      <MenuPopup>{children}</MenuPopup>
    </Menu>
  );
}

describe("the Convert menu", () => {
  const commands = () => ({ open: vi.fn(), again: vi.fn(), updateRates: vi.fn() });

  it("opens a category, and dims Currency with the reason", async () => {
    const now = commands();
    render(
      menu(
        <CalculatorConvertItems
          recent={[]}
          hasNumber={true}
          ratesServed={false}
          commands={() => now}
        />,
      ),
    );
    for (const name of ["Currency…", "Update Currency Exchange Rates…"]) {
      const row = await screen.findByRole("menuitem", { name });
      expect(row).toHaveAttribute("aria-disabled", "true");
      expect(row).toHaveAttribute("title", NO_CURRENCY);
    }
    fireEvent.click(screen.getByRole("menuitem", { name: "Temperature…" }));
    expect(now.open).toHaveBeenCalledWith("temperature");
  });

  const served = (now: ReturnType<typeof commands>) =>
    render(
      menu(
        <CalculatorConvertItems
          recent={[]}
          hasNumber={true}
          ratesServed={true}
          commands={() => now}
        />,
      ),
    );

  it("opens Currency on a served desktop", async () => {
    const now = commands();
    served(now);
    fireEvent.click(await screen.findByRole("menuitem", { name: "Currency…" }));
    expect(now.open).toHaveBeenCalledWith("currency");
  });

  it("updates the rates on a served desktop", async () => {
    const now = commands();
    served(now);
    fireEvent.click(
      await screen.findByRole("menuitem", { name: "Update Currency Exchange Rates…" }),
    );
    expect(now.updateRates).toHaveBeenCalledTimes(1);
  });

  it("dims every category in Programmer, and says why", async () => {
    render(
      menu(
        <CalculatorConvertItems
          recent={[]}
          hasNumber={true}
          ratesServed={true}
          refused={NO_CONVERT_IN_PROGRAMMER}
          commands={commands}
        />,
      ),
    );
    const row = await screen.findByRole("menuitem", { name: "Length…" });
    expect(row).toHaveAttribute("aria-disabled", "true");
    expect(row).toHaveAttribute("title", NO_CONVERT_IN_PROGRAMMER);
  });
});

describe("the Convert sheet", () => {
  const placed = (over: Partial<React.ComponentProps<typeof ConvertSheet>> = {}) => {
    const onConvert = vi.fn();
    const onClose = vi.fn();
    const anchor = document.createElement("div");
    document.body.append(anchor);
    render(
      <ConvertSheet
        category="length"
        recent={[]}
        anchor={anchor}
        finalFocus={false}
        onConvert={onConvert}
        onClose={onClose}
        {...over}
      />,
    );
    return { onConvert, onClose };
  };

  const RATES = {
    date: "2026-11-06",
    source: "European Central Bank",
    rates: { EUR: 1, USD: 1.25 },
  };

  it("converts between the currencies the rates hold, and says their date and source", async () => {
    const { onConvert } = placed({
      category: "currency",
      rates: { kind: "read", rates: RATES },
    });
    expect(
      await screen.findByText(
        "Last updated: November 6, 2026. European Central Bank reference rates.",
      ),
    ).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Convert" }));
    expect(onConvert).toHaveBeenCalledWith({
      category: "currency",
      from: "Euro",
      to: "US Dollar",
    });
  });

  it("says the rates cannot be read, and converts nothing", async () => {
    const { onConvert } = placed({
      category: "currency",
      rates: { kind: "failed", problem: "European Central Bank: no answer" },
    });
    expect(
      await screen.findByText("The exchange rates can’t be read. European Central Bank: no answer"),
    ).toBeInTheDocument();
    const button = screen.getByRole("button", { name: "Convert" });
    expect(button).toBeDisabled();
    fireEvent.click(button);
    expect(onConvert).not.toHaveBeenCalled();
  });

  it("converts between the first two units at first", async () => {
    const { onConvert } = placed();
    fireEvent.click(await screen.findByRole("button", { name: "Convert" }));
    expect(onConvert).toHaveBeenCalledWith({
      category: "length",
      from: "Centimeters",
      to: "Feet",
    });
  });

  it("starts from the units last used in that category", async () => {
    const { onConvert } = placed({
      recent: [
        { category: "mass", from: "Pounds", to: "Grams" },
        { category: "length", from: "Miles", to: "Meters" },
      ],
    });
    fireEvent.click(await screen.findByRole("button", { name: "Convert" }));
    expect(onConvert).toHaveBeenCalledWith({ category: "length", from: "Miles", to: "Meters" });
  });

  it("closes with Cancel, converting nothing", async () => {
    const { onConvert, onClose } = placed();
    fireEvent.click(await screen.findByRole("button", { name: "Cancel" }));
    expect(onClose).toHaveBeenCalled();
    expect(onConvert).not.toHaveBeenCalled();
  });
});

describe("speech", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("names typed keys as the keypad names them", () => {
    expect(spokenKey({ type: "digit", digit: "7" })).toBe("7");
    expect(spokenKey({ type: "operator", operator: "add" })).toBe("Add");
    expect(spokenKey({ type: "equals" })).toBe("Equals");
    expect(spokenKey({ type: "open" })).toBeNull();
  });

  it("dims the Speech rows with the reason in a browser with no voice", async () => {
    vi.stubGlobal("speechSynthesis", undefined);
    render(
      menu(
        <CalculatorSpeechItems
          speakButtons={false}
          speakResults={false}
          commands={() => ({ setSpeakButtons: vi.fn(), setSpeakResults: vi.fn() })}
        />,
      ),
    );
    const row = await screen.findByRole("menuitemcheckbox", { name: "Speak Result" });
    expect(row).toHaveAttribute("aria-disabled", "true");
    expect(row).toHaveAttribute("title", "This browser has no voice to speak with.");
    expect(() => speakKey("7")).not.toThrow();
  });
});

describe("the tape as a file", () => {
  const lines = [
    { id: "1", expression: "12 + 3", result: "15" },
    { id: "2", expression: "2 × 4", result: "8" },
  ];

  it("writes each calculation over its result", () => {
    expect(tapeTextLines(lines)).toEqual(["12 + 3", "= 15", "2 × 4", "= 8"]);
  });

  it("prints those lines in a frame of their own", () => {
    printTape(lines);
    const frame = document.querySelector("iframe[data-textedit-print]") as HTMLIFrameElement;
    expect(frame.srcdoc).toContain("12 + 3");
    expect(frame.srcdoc).toContain("= 15");
    frame.remove();
  });

  it("offers a Save panel with the tape's name", async () => {
    const anchor = document.createElement("div");
    document.body.append(anchor);
    const user = userEvent.setup();
    const onClose = vi.fn();
    render(
      <TapeSaveSheet open lines={lines} anchor={anchor} finalFocus={false} onClose={onClose} />,
    );
    await waitFor(() =>
      expect(screen.getByRole("textbox", { name: /save as/i })).toHaveValue("Paper Tape.txt"),
    );
    await user.click(screen.getByRole("button", { name: "Cancel" }));
    expect(onClose).toHaveBeenCalled();
  });
});
