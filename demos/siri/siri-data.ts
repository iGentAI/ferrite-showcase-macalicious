/**
 * What the Siri demo knows: the Weather result of the two reference captures and a handful of
 * canned requests with their answers. Nothing is listened to, looked up or computed.
 */

/** A condition of the sky. The demo draws each as a plain shape, not as Apple's glyph. */
export type SiriCondition = "sunny" | "partly-cloudy" | "partly-cloudy-night" | "clear-night";

/** The name a condition is announced with, in place of its glyph. */
export const CONDITION_NAMES: Readonly<Record<SiriCondition, string>> = {
  sunny: "Sunny",
  "partly-cloudy": "Partly cloudy",
  "partly-cloudy-night": "Partly cloudy night",
  "clear-night": "Clear night",
};

export interface SiriHour {
  /** The hour as the card labels it: "4 PM". */
  hour: string;
  condition: SiriCondition;
  /** Degrees, shown without a degree sign. */
  degrees: number;
}

export interface SiriForecast {
  city: string;
  /** The glyph of the summary. */
  condition: SiriCondition;
  /**
   * The three lines under the city. A line break in one is where its label breaks in the
   * capture; where a label would break by itself depends on the font it is set in.
   */
  lines: readonly [string, string, string];
  /** The large temperature, in degrees. */
  temperature: number;
  hours: readonly SiriHour[];
}

/** How many hourly rows each capture shows; the rows after them are the demo's own. */
export const CAPTURED_HOURS = 10;

const hours = (rows: readonly [string, SiriCondition, number][]): SiriHour[] =>
  rows.map(([hour, condition, degrees]) => ({ hour, condition, degrees }));

/**
 * The Weather result of 10-15-Catalina-Light-Siri.png. The first ten hours are the capture's;
 * the card runs on under the bottom strip there, and the last two rows are invented so that
 * it does here too.
 */
export const lightForecast: SiriForecast = {
  city: "Memphis",
  condition: "sunny",
  lines: ["Sunny", "Chance of\nRain: 20%", "High: 97° Low: 64°"],
  temperature: 95,
  hours: hours([
    ["4 PM", "partly-cloudy", 96],
    ["5 PM", "partly-cloudy", 93],
    ["6 PM", "sunny", 91],
    ["7 PM", "partly-cloudy-night", 87],
    ["8 PM", "partly-cloudy-night", 84],
    ["9 PM", "clear-night", 82],
    ["10 PM", "clear-night", 78],
    ["11 PM", "clear-night", 78],
    ["12 AM", "clear-night", 75],
    ["1 AM", "clear-night", 73],
    ["2 AM", "clear-night", 72],
    ["3 AM", "clear-night", 70],
  ]),
};

/** The Weather result of 10-15-Catalina-Dark-Siri.png; the last two rows are invented. */
export const darkForecast: SiriForecast = {
  city: "Memphis",
  condition: "sunny",
  lines: ["Sunny", "Chance of Rain: 0%", "High: 84° Low: 61°"],
  temperature: 73,
  hours: hours([
    ["12 PM", "sunny", 75],
    ["1 PM", "sunny", 78],
    ["2 PM", "sunny", 80],
    ["3 PM", "sunny", 82],
    ["4 PM", "sunny", 82],
    ["5 PM", "sunny", 80],
    ["6 PM", "sunny", 78],
    ["7 PM", "clear-night", 75],
    ["8 PM", "clear-night", 73],
    ["9 PM", "clear-night", 71],
    ["10 PM", "clear-night", 69],
    ["11 PM", "clear-night", 67],
  ]),
};

/** The forecast of each reference capture, by the appearance it was taken in. */
export const FORECASTS = { light: lightForecast, dark: darkForecast } as const;

/** Which capture's forecast the Weather card shows. */
export type SiriCapture = keyof typeof FORECASTS;

/** What a card shows under its header. */
export type SiriAnswerCard =
  /** The Weather snippet, with the forecast of the capture the window was asked for. */
  | { kind: "weather"; title: string }
  /** One large value with a caption above it and, optionally, a line under it. */
  | { kind: "value"; title: string; caption: string; value: string; detail?: string };

export interface SiriRequest {
  /** Identifies the request among the others. */
  id: string;
  /** The request as Siri understood it: the text at the top of the window. */
  phrase: string;
  /** What Siri says back, under the request. */
  reply: string;
  /**
   * How typed text is understood as this request: it is, when it holds every word of one of
   * these lists.
   */
  keywords: readonly (readonly string[])[];
  /** The result card. A request without one is answered by `reply` alone. */
  card?: SiriAnswerCard;
  /** The id of the application the request opens; a host hears of it through `onAnswer`. */
  opens?: string;
}

/** The requests the demo can answer, in the order the orb "hears" them. */
export const defaultRequests: readonly SiriRequest[] = [
  {
    id: "weather",
    phrase: "What’s the weather like today?",
    reply: "Here’s the forecast for today:",
    keywords: [["weather"], ["forecast"]],
    card: { kind: "weather", title: "Weather" },
  },
  {
    id: "calculation",
    phrase: "What’s 18 percent of 240?",
    reply: "18% of 240 is 43.2.",
    keywords: [["18", "240"]],
    card: { kind: "value", title: "Calculator", caption: "18% of 240 =", value: "43.2" },
  },
  {
    id: "time",
    phrase: "What time is it in Cupertino?",
    reply: "In Cupertino, it’s 9:41 AM.",
    keywords: [["time"]],
    card: {
      kind: "value",
      title: "Clock",
      caption: "Cupertino, California",
      value: "9:41 AM",
      detail: "Monday, October 7, 2019",
    },
  },
  {
    id: "open-calculator",
    phrase: "Open Calculator",
    reply: "OK, opening Calculator.",
    keywords: [["open", "calculator"]],
    opens: "calculator",
  },
];

/** Siri's own prompt, while it waits or listens. */
export const GREETING = "What can I help you with?";
/** The line over the example requests. */
export const HELP_HEADING = "Some things you can ask me:";
/** What Siri says to typed text that is none of its requests. */
export const NOT_UNDERSTOOD = "I’m not sure I understand.";

/** Lower case, with apostrophes dropped and everything else that is not a letter or digit a space. */
const words = (text: string) =>
  text
    .toLowerCase()
    .replace(/[’']/g, "")
    .split(/[^a-z0-9]+/)
    .filter(Boolean);

/**
 * The request that typed text asks for: the first one whose phrase it is, or that has a list
 * of keywords all found among its words. `undefined` when it is none of them.
 */
export function understand(
  text: string,
  requests: readonly SiriRequest[] = defaultRequests,
): SiriRequest | undefined {
  const typed = words(text);
  if (typed.length === 0) return undefined;
  return requests.find(
    (request) =>
      words(request.phrase).join(" ") === typed.join(" ") ||
      request.keywords.some((list) => list.every((word) => typed.includes(word))),
  );
}

/**
 * The request the orb "hears" next: the one after `lastId` in the list, and the first one
 * after the last or when `lastId` names none.
 */
export function nextRequest(
  requests: readonly SiriRequest[],
  lastId: string | undefined,
): SiriRequest | undefined {
  const index = requests.findIndex((request) => request.id === lastId);
  return requests[(index + 1) % requests.length];
}

/**
 * Where the results stand once an answer's card is shown: an answer that fits is not
 * scrolled, and one taller than the region is scrolled until its card is at the top, or as far
 * as the content goes. `cardTop` is the card's distance from the top of the content.
 */
export function answerScrollTop(cardTop: number, contentHeight: number, regionHeight: number) {
  const room = contentHeight - regionHeight;
  return room > 0 ? Math.min(Math.max(cardTop, 0), room) : 0;
}
