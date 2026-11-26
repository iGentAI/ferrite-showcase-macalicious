import { act, fireEvent, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { createRef } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { LISTEN_DURATION, SiriAssistant } from "./siri";
import {
  answerScrollTop,
  defaultRequests,
  GREETING,
  HELP_HEADING,
  NOT_UNDERSTOOD,
  understand,
} from "./siri-data";

const request = (id: string) => {
  const found = defaultRequests.find((candidate) => candidate.id === id);
  if (!found) throw new Error(`no request "${id}"`);
  return found;
};
const weather = request("weather");
const calculation = request("calculation");
const time = request("time");
const openCalculator = request("open-calculator");

const frame = () => screen.getByRole("dialog", { name: "Siri" });
const results = () => screen.getByRole("group", { name: "Results" });
/** The text at the top of the results: the request as understood, or Siri's own prompt. */
const prompt = () => results().querySelector(".mac-siri-prompt")?.textContent;
const orb = () => screen.getByRole("button", { name: "Listen" });
const listening = () => orb().getAttribute("aria-pressed") === "true";
const card = (name: string) => screen.getByRole("article", { name });
const cards = () => screen.queryAllByRole("article");
const examples = () =>
  within(screen.getByRole("list", { name: "Example requests" }))
    .getAllByRole("button")
    .map((button) => button.textContent);
const wait = (milliseconds: number) => act(() => vi.advanceTimersByTime(milliseconds));

afterEach(() => {
  vi.useRealTimers();
});

describe("the window", () => {
  it.each([
    {
      capture: "light" as const,
      temperature: "95°",
      lines: ["Sunny", "Chance of Rain: 20%", "High: 97° Low: 64°"],
      first: ["4 PM", "Partly cloudy", "96"],
      tenth: ["1 AM", "Clear night", "73"],
    },
    {
      capture: "dark" as const,
      temperature: "73°",
      lines: ["Sunny", "Chance of Rain: 0%", "High: 84° Low: 61°"],
      first: ["12 PM", "Sunny", "75"],
      tenth: ["9 PM", "Clear night", "71"],
    },
  ])("opens on the Weather result of the $capture capture", (expected) => {
    render(<SiriAssistant capture={expected.capture} />);
    expect(frame()).toHaveClass("mac-siri", "mac-siri-demo");
    expect(listening()).toBe(false);
    expect(prompt()).toBe(`“${weather.phrase}”`);

    const result = within(card("Weather"));
    expect(result.getByText("Memphis")).toBeVisible();
    for (const line of expected.lines) expect(result.getByText(line)).toBeVisible();
    expect(result.getByText(expected.temperature)).toBeVisible();

    // An hour is its label, the condition its placeholder stands for, and the degrees.
    const rows = within(result.getByRole("list", { name: "Hourly forecast" }))
      .getAllByRole("listitem")
      .map((row) => [
        row.firstElementChild?.textContent,
        within(row).getByRole("img").getAttribute("aria-label"),
        row.lastElementChild?.textContent,
      ]);
    expect(rows[0]).toEqual(expected.first);
    expect(rows[9]).toEqual(expected.tenth);
  });

  it("waits with Siri's own prompt when it has no request to answer", () => {
    render(<SiriAssistant defaultRequest={null} />);
    expect(prompt()).toBe(GREETING);
    expect(cards()).toEqual([]);
    expect(listening()).toBe(false);
    // Typing is a setting, as in macOS: without it there is no field.
    expect(screen.queryByRole("textbox")).toBeNull();
  });

  it("is the library's window: ref, class, style and attributes reach its root", () => {
    const ref = createRef<HTMLDivElement>();
    render(<SiriAssistant ref={ref} className="host" data-host="desk" style={{ height: 320 }} />);
    expect(ref.current).toBe(frame());
    expect(frame()).toHaveClass("host");
    expect(frame()).toHaveAttribute("data-host", "desk");
    expect(frame().style.height).toBe("320px");
  });
});

describe("the orb", () => {
  it("listens, then answers the next request of the list when its time is up", () => {
    // Listening is a timer; fake timers stand in for the 2.4 seconds it takes.
    vi.useFakeTimers();
    const onAnswer = vi.fn();
    render(<SiriAssistant onAnswer={onAnswer} />);

    fireEvent.click(orb());
    expect(listening()).toBe(true);
    expect(frame()).toHaveAttribute("data-listening");
    expect(prompt()).toBe(GREETING);
    expect(cards()).toEqual([]);

    wait(LISTEN_DURATION - 1);
    expect(listening()).toBe(true);
    expect(onAnswer).not.toHaveBeenCalled();

    wait(1);
    expect(listening()).toBe(false);
    expect(prompt()).toBe(`“${calculation.phrase}”`);
    expect(within(card("Calculator")).getByText("43.2")).toBeVisible();
    expect(onAnswer).toHaveBeenCalledTimes(1);
    expect(onAnswer).toHaveBeenLastCalledWith(calculation);
    // Nothing keeps ticking once it has answered.
    expect(vi.getTimerCount()).toBe(0);

    fireEvent.click(orb());
    wait(LISTEN_DURATION);
    expect(within(card("Clock")).getByText("9:41 AM")).toBeVisible();

    // A request that opens an application is answered in words, and the host hears which.
    fireEvent.click(orb());
    wait(LISTEN_DURATION);
    expect(prompt()).toBe(`“${openCalculator.phrase}”`);
    expect(results()).toHaveTextContent(openCalculator.reply);
    expect(cards()).toEqual([]);
    expect(onAnswer).toHaveBeenLastCalledWith(expect.objectContaining({ opens: "calculator" }));

    // After the last request the list starts over.
    fireEvent.click(orb());
    wait(LISTEN_DURATION);
    expect(card("Weather")).toBeVisible();
    expect(onAnswer).toHaveBeenCalledTimes(4);
  });

  it("stops listening on a second click, without an answer", () => {
    vi.useFakeTimers();
    const onAnswer = vi.fn();
    render(<SiriAssistant onAnswer={onAnswer} />);
    fireEvent.click(orb());
    wait(LISTEN_DURATION / 2);
    fireEvent.click(orb());
    expect(listening()).toBe(false);
    expect(vi.getTimerCount()).toBe(0);
    wait(LISTEN_DURATION);
    expect(prompt()).toBe(GREETING);
    expect(onAnswer).not.toHaveBeenCalled();
  });

  it("keeps its time when the host renders again while it listens", () => {
    vi.useFakeTimers();
    const { rerender } = render(<SiriAssistant onAnswer={() => {}} />);
    fireEvent.click(orb());
    wait(LISTEN_DURATION - 1);
    rerender(<SiriAssistant onAnswer={() => {}} requests={[...defaultRequests]} />);
    wait(1);
    expect(card("Calculator")).toBeVisible();
  });

  it("just stops listening when it has no request to hear", () => {
    vi.useFakeTimers();
    const onAnswer = vi.fn();
    render(<SiriAssistant requests={[]} onAnswer={onAnswer} />);
    fireEvent.click(orb());
    wait(LISTEN_DURATION);
    expect(listening()).toBe(false);
    expect(prompt()).toBe(GREETING);
    expect(onAnswer).not.toHaveBeenCalled();
  });
});

describe("closing", () => {
  it("closes from the close button and stops listening", () => {
    vi.useFakeTimers();
    const onClose = vi.fn();
    const onOpenChange = vi.fn();
    render(<SiriAssistant onClose={onClose} onOpenChange={onOpenChange} />);
    fireEvent.click(orb());
    expect(vi.getTimerCount()).toBe(1);

    fireEvent.click(screen.getByRole("button", { name: "Close" }));
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(onClose).toHaveBeenCalledTimes(1);
    expect(onOpenChange).toHaveBeenCalledWith(false);
    expect(vi.getTimerCount()).toBe(0);
  });

  it("closes on Escape while the keyboard is in the window", async () => {
    const user = userEvent.setup();
    render(<SiriAssistant />);
    await user.keyboard("{Escape}");
    expect(frame()).toBeVisible();

    await user.tab();
    await user.keyboard("{Escape}");
    expect(screen.queryByRole("dialog")).toBeNull();
  });

  it("stays open until a host that controls it says otherwise", async () => {
    const user = userEvent.setup();
    const onOpenChange = vi.fn();
    const { rerender } = render(<SiriAssistant open onOpenChange={onOpenChange} />);
    await user.click(screen.getByRole("button", { name: "Close" }));
    expect(onOpenChange).toHaveBeenCalledWith(false);
    expect(frame()).toBeVisible();

    rerender(<SiriAssistant open={false} onOpenChange={onOpenChange} />);
    expect(screen.queryByRole("dialog")).toBeNull();
  });

  it("listens and takes the keyboard when it is shown again", () => {
    vi.useFakeTimers();
    const { rerender } = render(<SiriAssistant open={false} />);
    rerender(<SiriAssistant open />);
    expect(frame()).toHaveFocus();
    expect(listening()).toBe(true);
    expect(prompt()).toBe(GREETING);
    // It had answered nothing yet, so it hears the first request of the list.
    wait(LISTEN_DURATION);
    expect(card("Weather")).toBeVisible();
  });

  it("leaves the keyboard where it is when it is there from the start", () => {
    render(<SiriAssistant />);
    expect(document.body).toHaveFocus();
  });
});

describe("the help button", () => {
  it("lists the requests, and a chosen one is answered at once", async () => {
    const user = userEvent.setup();
    const onAnswer = vi.fn();
    render(<SiriAssistant onAnswer={onAnswer} />);

    await user.click(screen.getByRole("button", { name: "Help" }));
    expect(prompt()).toBe(HELP_HEADING);
    expect(cards()).toEqual([]);
    expect(examples()).toEqual(defaultRequests.map((example) => `“${example.phrase}”`));

    await user.click(screen.getByRole("button", { name: `“${time.phrase}”` }));
    expect(prompt()).toBe(`“${time.phrase}”`);
    expect(results()).toHaveTextContent(time.reply);
    expect(within(card("Clock")).getByText("Cupertino, California")).toBeVisible();
    expect(onAnswer).toHaveBeenCalledWith(time);
    expect(screen.queryByRole("list", { name: "Example requests" })).toBeNull();
  });

  it("keeps the keyboard in the window when a chosen example replaces the list", async () => {
    const user = userEvent.setup();
    const onOpenChange = vi.fn();
    render(<SiriAssistant onOpenChange={onOpenChange} />);

    await user.click(screen.getByRole("button", { name: "Help" }));
    screen.getByRole("button", { name: `“${time.phrase}”` }).focus();
    await user.keyboard("{Enter}");
    expect(prompt()).toBe(`“${time.phrase}”`);
    // The button that had the focus is gone; the window has it, not the document.
    expect(frame()).toHaveFocus();

    await user.keyboard("{Escape}");
    expect(onOpenChange).toHaveBeenCalledWith(false);
    expect(screen.queryByRole("dialog", { name: "Siri" })).toBeNull();
  });

  it("puts the examples away on a second click, and ends listening", () => {
    vi.useFakeTimers();
    render(<SiriAssistant />);
    const help = screen.getByRole("button", { name: "Help" });

    fireEvent.click(orb());
    fireEvent.click(help);
    expect(listening()).toBe(false);
    expect(vi.getTimerCount()).toBe(0);
    expect(prompt()).toBe(HELP_HEADING);

    fireEvent.click(help);
    expect(prompt()).toBe(GREETING);
    expect(screen.queryByRole("list", { name: "Example requests" })).toBeNull();
  });
});

describe("Type to Siri", () => {
  const field = () => screen.getByRole("textbox", { name: "Type to Siri" });

  it("answers a typed request on Return and empties the field", async () => {
    const user = userEvent.setup();
    const onAnswer = vi.fn();
    render(<SiriAssistant typeToSiri defaultRequest={null} onAnswer={onAnswer} />);

    await user.type(field(), "Will I need the forecast?{Enter}");
    expect(prompt()).toBe(`“${weather.phrase}”`);
    expect(card("Weather")).toBeVisible();
    expect(onAnswer).toHaveBeenCalledWith(weather);
    expect(field()).toHaveValue("");
  });

  it("offers its examples for text it does not understand", async () => {
    const user = userEvent.setup();
    const onAnswer = vi.fn();
    render(<SiriAssistant typeToSiri onAnswer={onAnswer} />);

    await user.type(field(), "Tell me a joke{Enter}");
    expect(prompt()).toBe(GREETING);
    expect(results()).toHaveTextContent(NOT_UNDERSTOOD);
    expect(examples()).toHaveLength(defaultRequests.length);
    expect(cards()).toEqual([]);
    expect(onAnswer).not.toHaveBeenCalled();

    // Return in an empty field asks nothing.
    await user.type(field(), "   {Enter}");
    expect(results()).toHaveTextContent(NOT_UNDERSTOOD);
  });
});

describe("scrolling to the card", () => {
  // jsdom lays nothing out: these stand-ins give the results region and the card the sizes of
  // the Weather answer in the window (a 513 pt region, 678 pt of content, the card 74 pt
  // down), keep a scroll position per element, and let a test report a resize.
  const box = { region: 513, content: 678, cardTop: 74 };
  const scrolled = new WeakMap<Element, number>();
  const observers: { callback: () => void; targets: Set<Element> }[] = [];
  const isResults = (element: Element) => element.classList.contains("mac-siri-results");

  beforeEach(() => {
    Object.assign(box, { region: 513, content: 678, cardTop: 74 });
    observers.length = 0;
    const proto = HTMLElement.prototype;
    Object.defineProperty(proto, "scrollTop", {
      configurable: true,
      get(this: Element) {
        return scrolled.get(this) ?? 0;
      },
      set(this: Element, value: number) {
        scrolled.set(this, value);
      },
    });
    Object.defineProperty(proto, "scrollHeight", {
      configurable: true,
      get(this: Element) {
        return isResults(this) ? box.content : 0;
      },
    });
    Object.defineProperty(proto, "clientHeight", {
      configurable: true,
      get(this: Element) {
        return isResults(this) ? box.region : 0;
      },
    });
    Object.defineProperty(proto, "getBoundingClientRect", {
      configurable: true,
      value(this: Element) {
        const region = this.closest(".mac-siri-results");
        const top =
          this.classList.contains("mac-siri-card") && region ? box.cardTop - region.scrollTop : 0;
        return new DOMRect(0, top, 0, 0);
      },
    });
    vi.stubGlobal(
      "ResizeObserver",
      class {
        targets = new Set<Element>();
        callback: () => void;
        constructor(callback: () => void) {
          this.callback = callback;
          observers.push(this);
        }
        observe(target: Element) {
          this.targets.add(target);
        }
        unobserve(target: Element) {
          this.targets.delete(target);
        }
        disconnect() {
          this.targets.clear();
        }
      },
    );
  });

  afterEach(() => {
    const proto = HTMLElement.prototype as unknown as Record<string, unknown>;
    for (const name of ["scrollTop", "scrollHeight", "clientHeight", "getBoundingClientRect"]) {
      delete proto[name];
    }
    vi.unstubAllGlobals();
  });

  /** Reports a resize to every observer that still watches something, as a browser would. */
  const resize = (change: Partial<typeof box>) => {
    Object.assign(box, change);
    act(() => {
      for (const observer of observers) if (observer.targets.size > 0) observer.callback();
    });
  };
  const watched = () => observers.flatMap((observer) => [...observer.targets]);

  it("scrolls a tall answer until its card is at the top", () => {
    render(<SiriAssistant />);
    expect(results().scrollTop).toBe(74);
    expect(watched()).toEqual([results(), card("Weather")]);
  });

  it("places the card again when the window is resized", () => {
    render(<SiriAssistant />);
    // A taller window leaves less to scroll: only as far as the content goes.
    resize({ region: 640 });
    expect(results().scrollTop).toBe(38);
    // Tall enough for the whole answer: nothing to scroll.
    resize({ region: 700 });
    expect(results().scrollTop).toBe(0);
    // Back to the captured size: the card is at the top again.
    resize({ region: 513 });
    expect(results().scrollTop).toBe(74);
  });

  it("places the card again when the card changes size", () => {
    render(<SiriAssistant />);
    resize({ content: 560 });
    expect(results().scrollTop).toBe(47);
  });

  it("goes back to the top when the results have no card", () => {
    vi.useFakeTimers();
    render(<SiriAssistant />);
    expect(results().scrollTop).toBe(74);

    // The examples have no card.
    fireEvent.click(screen.getByRole("button", { name: "Help" }));
    expect(cards()).toEqual([]);
    expect(results().scrollTop).toBe(0);
    // Nor does a resize scroll them: there is no card to scroll to.
    resize({ region: 400 });
    expect(results().scrollTop).toBe(0);
    expect(watched()).toEqual([results()]);

    // A card again, then listening, which shows none.
    fireEvent.click(screen.getByRole("button", { name: `“${weather.phrase}”` }));
    expect(results().scrollTop).toBe(74);
    fireEvent.click(orb());
    expect(results().scrollTop).toBe(0);

    // An answer in words only: the orb hears Calculator, the Clock, then "Open Calculator".
    wait(LISTEN_DURATION);
    fireEvent.click(orb());
    wait(LISTEN_DURATION);
    fireEvent.click(orb());
    wait(LISTEN_DURATION);
    expect(prompt()).toBe(`“${openCalculator.phrase}”`);
    expect(cards()).toEqual([]);
    expect(results().scrollTop).toBe(0);
  });

  it("keeps the results at the top under the text field, also on resize", () => {
    render(<SiriAssistant typeToSiri />);
    expect(results().scrollTop).toBe(0);
    resize({ region: 640 });
    expect(results().scrollTop).toBe(0);
  });

  it("stops watching sizes when the window closes", () => {
    render(<SiriAssistant />);
    fireEvent.click(screen.getByRole("button", { name: "Close" }));
    expect(watched()).toEqual([]);
  });
});

describe("the rules", () => {
  it.each([
    ["whats the WEATHER like today", "weather"],
    ["what is 18 percent of 240", "calculation"],
    ["what is 20 percent of 240", undefined],
    ["Do you have the time?", "time"],
    ["open calculator, please", "open-calculator"],
    ["open Safari", undefined],
    ["timetable", undefined],
  ])("understands %j as %s", (text, id) => {
    expect(understand(text)?.id).toBe(id);
  });

  // jsdom lays nothing out, so where an answer is scrolled to is checked as a rule; the two
  // comparisons with the captures show it in a browser.
  it.each([
    { name: "an answer that fits is not scrolled", card: 74, content: 240, region: 513, top: 0 },
    { name: "a tall answer has its card at the top", card: 74, content: 678, region: 513, top: 74 },
    {
      name: "it is scrolled no further than the content goes",
      card: 74,
      content: 560,
      region: 513,
      top: 47,
    },
  ])("$name", ({ card: cardTop, content, region, top }) => {
    expect(answerScrollTop(cardTop, content, region)).toBe(top);
  });
});
