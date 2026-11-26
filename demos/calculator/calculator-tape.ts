import { useCallback, useEffect, useRef, useState } from "react";
import { SERVER_CHANGE_EVENT } from "../desktop/desktop-live";
import { sessionFetch, withDeadline } from "../desktop/desktop-server";
import {
  type CalculatorAction,
  type CalculatorOperator,
  type CalculatorState,
  displayText,
  formatNumber,
} from "./calculator-engine";

/*
 * Calculator's paper tape: the record of finished calculations that macOS shows under
 * Window > Show Paper Tape, and its link to the server half, `/api/calculator/tape` of the
 * macalicious-desktop Ferrite application (ferrite-apps/desktop/src/apps/calculator). Only the
 * desktop build made for that application sets `VITE_MACALICIOUS_API` to "1". Anywhere else (the
 * documentation, the tests, a copy of the demo) nothing is fetched and no tape is shown.
 */

/** The tape's address on the Ferrite application. */
export const TAPE_URL = "/api/calculator/tape";

/**
 * Whether this build is the desktop of the Ferrite application: its build
 * (`ferrite-apps/desktop/scripts/pack-site.mjs`) sets `VITE_MACALICIOUS_API=1`. Read when called,
 * so that a test can stub it.
 */
export function tapeServed(): boolean {
  return import.meta.env.VITE_MACALICIOUS_API === "1";
}
/** The most entries the server keeps (`TAPE_LIMIT`); the page shows no more. */
export const TAPE_LIMIT = 100;
/** The longest expression the server takes, in characters (`MAX_EXPRESSION_CHARS`). */
export const MAX_EXPRESSION = 200;

export const OPERATOR_SYMBOLS: Record<CalculatorOperator, string> = {
  add: "+",
  subtract: "−",
  multiply: "×",
  divide: "÷",
  power: "^",
  powerOf: "ʸ",
  root: "√",
  logBase: "log",
};

/** The number before a key, as written down; a closing parenthesis already wrote its sum. */
const closing = (expression: string, before: CalculatorState) =>
  expression.endsWith(") ") ? "" : displayText(before);

/**
 * The expression of a calculation whose last closed parenthesis a function just took: the number the
 * function made takes the parenthesis's place, as it does for a number that was typed.
 */
function withoutClosedGroup(expression: string): string {
  if (!expression.endsWith(") ")) return expression;
  let depth = 0;
  for (let at = expression.length - 1; at >= 0; at--) {
    if (expression[at] === ")") depth++;
    else if (expression[at] === "(" && --depth === 0) return expression.slice(0, at);
  }
  return expression;
}

/** A calculation that `=` finished: what the tape records. */
export interface FinishedCalculation {
  expression: string;
  result: string;
}

/**
 * Follows the keys of one calculation to write it down: `expression` is the calculation so far
 * ("12 + "), as the operators and the numbers they close were pressed. Returns the expression
 * after `action`, which took the calculator from `before` to `after`, and the finished
 * calculation when the key was an `=` that calculated something.
 */
export function tapeStep(
  expression: string,
  before: CalculatorState,
  action: CalculatorAction,
  after: CalculatorState,
): { expression: string; finished?: FinishedCalculation } {
  switch (action.type) {
    case "operator": {
      // An operator whose sum came out as no number ended the calculation.
      if (after.pending.length === 0) return { expression: "" };
      const symbol = OPERATOR_SYMBOLS[action.operator];
      // A second operator in a row (or one after C) replaces the first, as the engine does.
      if (before.armed !== null && before.entry === null && before.pending.length > 0) {
        return { expression: expression.replace(/ \S+ $/, ` ${symbol} `) };
      }
      return {
        expression: `${expression}${closing(expression, before)} ${symbol} `.replace(/ {2}/, " "),
      };
    }
    case "open":
      return { expression: `${expression}( ` };
    case "close":
      return after === before
        ? { expression }
        : { expression: `${expression}${closing(expression, before)} ) ` };
    case "equals": {
      const result = displayText(after);
      if (before.pending.length > 0 || expression.endsWith(") ")) {
        return {
          expression: "",
          finished: { expression: `${expression}${closing(expression, before)}`.trimEnd(), result },
        };
      }
      if (before.repeat) {
        const { operator, operand } = before.repeat;
        return {
          expression: "",
          finished: {
            expression: `${displayText(before)} ${OPERATOR_SYMBOLS[operator]} ${formatNumber(operand)}`,
            result,
          },
        };
      }
      // `=` on a lone number calculates nothing.
      return { expression: "" };
    }
    case "clear":
      // AC ends the calculation; C clears the entry and keeps the sum.
      return { expression: before.clearable ? expression : "" };
    case "value":
      return { expression: action.ofDisplay ? withoutClosedGroup(expression) : expression };
    default:
      return { expression };
  }
}

/** One line of the paper tape. */
export interface TapeLine {
  id: string;
  expression: string;
  result: string;
  /** Not stored: the server could not be reached or refused it. */
  unsaved?: boolean;
  /** On its way to the server. */
  pending?: boolean;
}

interface Reply {
  status: number;
  body: unknown;
}

const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/** A random key for one calculation's `idempotency-key` header. */
function randomKey(): string {
  if (typeof crypto.randomUUID === "function") return crypto.randomUUID();
  // Outside a secure context there is no randomUUID, but there are random bytes.
  return Array.from(crypto.getRandomValues(new Uint8Array(16)), (byte) =>
    byte.toString(16).padStart(2, "0"),
  ).join("");
}

/**
 * One request to the tape. With `retry`, it is sent again once (with the same idempotency key)
 * when it could not be sent, its reply was lost before its body arrived, or the server failed
 * (5xx). `null` when it still failed. A DELETE is not resent: it has no key, and a second one
 * would also clear what another tab appended in between. Each attempt, the reading of its reply
 * included, has a deadline, so a request that hangs never holds up the tape's queue.
 */
async function send(
  method: string,
  { body, key, retry = true }: { body?: object; key?: string; retry?: boolean } = {},
): Promise<Reply | null> {
  const headers: Record<string, string> = {};
  if (body) headers["content-type"] = "application/json";
  if (key) headers["idempotency-key"] = key;
  const attempts = retry ? 2 : 1;
  for (let attempt = 0; attempt < attempts; attempt++) {
    try {
      const reply = await withDeadline(async (signal): Promise<Reply | null> => {
        const response = await sessionFetch(TAPE_URL, {
          method,
          credentials: "same-origin",
          headers,
          body: body ? JSON.stringify(body) : undefined,
          signal,
        });
        if (response.status >= 500) return null;
        // Reading the body can fail like the request: that goes to the retry below.
        const text = await response.text();
        let parsed: unknown = null;
        try {
          parsed = JSON.parse(text);
        } catch {
          // A reply without JSON: the status says enough.
        }
        return { status: response.status, body: parsed };
      });
      if (reply) return reply;
    } catch {
      // Sent again below.
    }
    if (attempt + 1 < attempts) await wait(500);
  }
  return null;
}

interface StoredEntry {
  expression: string;
  result: string;
}

const isEntry = (value: unknown): value is StoredEntry =>
  typeof value === "object" &&
  value !== null &&
  typeof (value as StoredEntry).expression === "string" &&
  typeof (value as StoredEntry).result === "string";

/** The entries of a tape reply, or `null` when the reply holds none. */
function entriesOf(body: unknown): StoredEntry[] | null {
  const entries = (body as { entries?: unknown } | null)?.entries;
  return Array.isArray(entries) ? entries.filter(isEntry) : null;
}

/** The calculation as the server takes it: an expression longer than it keeps loses its start. */
export function bounded({ expression, result }: FinishedCalculation): FinishedCalculation {
  return {
    expression:
      expression.length > MAX_EXPRESSION
        ? `…${expression.slice(-(MAX_EXPRESSION - 1)).trimStart()}`
        : expression,
    result,
  };
}

/** The lines with no more than [`TAPE_LIMIT`] stored ones, as the server keeps: the oldest go. */
function trimmed(lines: readonly TapeLine[]): readonly TapeLine[] {
  let excess = lines.filter((line) => !line.pending && !line.unsaved).length - TAPE_LIMIT;
  if (excess <= 0) return lines;
  return lines.filter((line) => line.pending || line.unsaved || excess-- <= 0);
}

/**
 * The session's paper tape, for a component: the lines to show, oldest first, `append` for a
 * finished calculation and `clear`. With `enabled` false (every build but the Ferrite
 * application's) nothing is fetched, `append` and `clear` do nothing and there are no lines.
 *
 * Requests run one at a time in the order given, so the first load never races a calculation.
 * A calculation is shown at once, in the order it was finished, and sent with a random
 * `idempotency-key`; a resend after a lost reply carries the same key, so the server records
 * it once. An expression longer than the server keeps is recorded with its start cut to "…".
 * One the server still did not take is logged, stays in its place on the tape marked unsaved,
 * and is not sent again. A Clear, whether it worked or not, shows what the server holds then,
 * followed by the calculations still waiting to be sent.
 */
export function useCalculatorTape(enabled: boolean = tapeServed()) {
  const [lines, setLines] = useState<readonly TapeLine[]>([]);
  /** What went wrong with the last Clear, shown in the tape window until the next one works. */
  const [error, setError] = useState<string | null>(null);
  const queue = useRef<Promise<void>>(Promise.resolve());
  const alive = useRef(true);
  const counter = useRef(0);

  const enqueue = useCallback((job: () => Promise<void>) => {
    queue.current = queue.current.then(job).catch((error) => console.error(error));
  }, []);
  const lineOf = useCallback(
    (entry: StoredEntry): TapeLine => ({
      id: `saved-${++counter.current}`,
      expression: entry.expression,
      result: entry.result,
    }),
    [],
  );

  useEffect(() => {
    alive.current = true;
    // This setup's own load: one a cleanup has passed (Strict Mode runs setup twice) is dropped.
    let current = true;
    if (enabled) {
      enqueue(async () => {
        if (!current) return;
        const reply = await send("GET");
        const entries = reply && reply.status < 300 ? entriesOf(reply.body) : null;
        if (!entries) {
          console.error(`Calculator could not load its paper tape from ${TAPE_URL}.`);
          return;
        }
        // What the session stored comes before what this page finished since it opened.
        if (current) setLines((shown) => trimmed([...entries.map(lineOf), ...shown]));
      });
    }
    return () => {
      current = false;
      alive.current = false;
    };
  }, [enabled, enqueue, lineOf]);

  // Another tab or browser of this person changed the tape: what the server holds now is the tape,
  // with this page's calculations not yet stored after it.
  useEffect(() => {
    if (!enabled) return;
    const changed = (event: Event) => {
      if ((event as CustomEvent<{ app?: unknown }>).detail?.app !== "calculator") return;
      enqueue(async () => {
        const reply = await send("GET");
        const entries = reply && reply.status < 300 ? entriesOf(reply.body) : null;
        if (!entries || !alive.current) return;
        setLines((shown) =>
          trimmed([
            ...entries.map(lineOf),
            ...shown.filter((line) => line.pending || line.unsaved),
          ]),
        );
      });
    };
    window.addEventListener(SERVER_CHANGE_EVENT, changed);
    return () => window.removeEventListener(SERVER_CHANGE_EVENT, changed);
  }, [enabled, enqueue, lineOf]);

  const append = useCallback(
    (finished: FinishedCalculation) => {
      if (!enabled) return;
      const { expression, result } = bounded(finished);
      const key = randomKey();
      const id = `line-${key}`;
      setLines((shown) => [...shown, { id, expression, result, pending: true }]);
      enqueue(async () => {
        // Sent even when the window has closed meanwhile: the calculation was finished.
        const reply = await send("POST", { body: { expression, result }, key });
        const stored = reply && reply.status < 300 && isEntry(reply.body) ? reply.body : null;
        if (!stored) {
          console.error(
            `Calculator could not save ${expression} = ${result} to its paper tape (${
              reply ? `HTTP ${reply.status}` : "no reply"
            }).`,
          );
        }
        if (!alive.current) return;
        // The line keeps its place: stored as the server answered, or marked unsaved.
        setLines((shown) =>
          trimmed(
            shown.map((line) =>
              line.id !== id
                ? line
                : stored
                  ? { id, expression: stored.expression, result: stored.result }
                  : { id, expression, result, unsaved: true },
            ),
          ),
        );
      });
    },
    [enabled, enqueue],
  );

  const clear = useCallback(() => {
    if (!enabled) return;
    enqueue(async () => {
      // Never resent: a DELETE has no key, and a second one would also clear what another tab
      // added in between.
      const reply = await send("DELETE", { retry: false });
      let entries = reply && reply.status < 300 ? entriesOf(reply.body) : null;
      if (!entries) {
        const message = "The paper tape could not be cleared.";
        console.error(`Calculator could not clear its paper tape at ${TAPE_URL}.`);
        if (alive.current) setError(message);
        // The clear may or may not have happened: show what the server holds now.
        const reload = await send("GET");
        entries = reload && reload.status < 300 ? entriesOf(reload.body) : null;
        if (!entries) return;
      } else if (alive.current) {
        setError(null);
      }
      if (!alive.current) return;
      const stored = entries;
      // The server's reply is the tape. Calculations still on their way stay after it; those
      // marked unsaved go, since a lost reply may hide one the server did store.
      setLines((shown) => [...stored.map(lineOf), ...shown.filter((line) => line.pending)]);
    });
  }, [enabled, enqueue, lineOf]);

  return { enabled, lines: enabled ? lines : [], error: enabled ? error : null, append, clear };
}
