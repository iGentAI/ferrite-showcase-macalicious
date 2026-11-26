"use client";

import { PushButton } from "macalicious/push-button";
import { TextField } from "macalicious/text-field";
import { TodayWidget } from "macalicious/today-widget";
import {
  type KeyboardEvent,
  type PointerEvent,
  type ReactNode,
  useEffect,
  useReducer,
  useState,
} from "react";
import {
  type CalculatorAction,
  displayText,
  initialCalculatorState,
  reduce,
} from "../calculator/calculator-engine";
import {
  movedTo,
  readTodayIds,
  TODAY_OFF,
  TODAY_ORDER,
  TODAY_STARTS_OFF,
  todayWidgets,
} from "../system-preferences/panes/extensions/today-widgets";
import { changeDesktopValue, desktopValues, useDesktopSetting } from "./desktop-personal";
import { sessionFetch, withDeadline } from "./desktop-server";
import { followDrag } from "./desktop-spaces-bar";

const NO_IDS: readonly string[] = [];

type Widget = ReturnType<typeof todayWidgets>[number];

/** Which widgets Today shows, in what order, and what the person can change about that. */
export function useTodayLayout() {
  const [order, setOrder] = useDesktopSetting(TODAY_ORDER, readTodayIds, NO_IDS);
  const [off, setOff] = useDesktopSetting(TODAY_OFF, readTodayIds, TODAY_STARTS_OFF);
  const widgets = todayWidgets(order, off);
  const shown = widgets.filter((widget) => widget.on);
  const available = widgets.filter((widget) => !widget.on);
  const shownIds = shown.map((widget): string => widget.id);
  const availableIds = available.map((widget): string => widget.id);
  return {
    shown,
    available,
    move: (id: string, index: number) =>
      setOrder([...movedTo(shownIds, id, index), ...availableIds]),
    remove: (id: string) => setOff([...off, id]),
    add: (id: string) => {
      setOff(off.filter((other) => other !== id));
      setOrder([...shownIds, id, ...availableIds.filter((other) => other !== id)]);
    },
  };
}

/**
 * Today while it is edited: each widget has a button to take it away, drags to another place, or moves
 * with Option-Up and Option-Down from that button. Its contents take no presses.
 */
export function TodayEditList({
  widgets,
  cardOf,
  onMove,
  onRemove,
}: {
  widgets: readonly Widget[];
  cardOf: (widget: Widget) => ReactNode;
  onMove: (id: string, index: number) => void;
  onRemove: (id: string) => void;
}) {
  const [drag, setDrag] = useState<{ id: string; to: number } | null>(null);
  const ids = widgets.map((widget): string => widget.id);
  const order = drag ? movedTo(ids, drag.id, drag.to) : ids;

  const press = (down: PointerEvent<HTMLLIElement>, id: string) => {
    if (down.button !== 0 || (down.target as Element).closest("button")) return;
    down.preventDefault();
    const row = down.currentTarget;
    // Where the others stood when it was picked up, so the list moving under it does not count.
    const middles = [...(row.parentElement?.children ?? [])]
      .filter((other) => other !== row)
      .map((other) => {
        const box = other.getBoundingClientRect();
        return box.top + box.height / 2;
      });
    const landing = (y: number) => middles.filter((middle) => middle < y).length;
    followDrag(
      down,
      (move) => setDrag({ id, to: landing(move.clientY) }),
      (up, started) => {
        setDrag(null);
        if (up && started) onMove(id, landing(up.clientY));
      },
    );
  };
  const keys = (event: KeyboardEvent<HTMLLIElement>, id: string) => {
    if (!event.altKey || (event.key !== "ArrowUp" && event.key !== "ArrowDown")) return;
    event.preventDefault();
    const to = ids.indexOf(id) + (event.key === "ArrowUp" ? -1 : 1);
    if (to >= 0 && to < ids.length) onMove(id, to);
  };

  return (
    <ul className="mac-desktop-shell-today-edit-list">
      {order.flatMap((id) => {
        const widget = widgets.find((each) => each.id === id);
        return widget ? (
          <li
            key={id}
            aria-label={widget.name}
            className="mac-desktop-shell-today-edit-row"
            data-dragging={drag?.id === id ? "" : undefined}
            onPointerDown={(event) => press(event, id)}
            onKeyDown={(event) => keys(event, id)}
          >
            <button
              type="button"
              className="mac-desktop-shell-today-edit-button"
              data-action="remove"
              aria-label={`Remove ${widget.name}`}
              onClick={() => onRemove(id)}
            />
            <div inert>{cardOf(widget)}</div>
          </li>
        ) : (
          []
        );
      })}
    </ul>
  );
}

/** What can be added while Today is edited, beside the panel. */
export function TodayAvailable({
  widgets,
  onAdd,
}: {
  widgets: readonly Widget[];
  onAdd: (id: string) => void;
}) {
  return (
    <section className="mac-desktop-shell-today-available" aria-label="Widgets to add">
      {widgets.length === 0 ? (
        <p className="mac-desktop-shell-today-detail">Every widget is showing.</p>
      ) : null}
      {widgets.map((widget) => (
        <div key={widget.id} className="mac-desktop-shell-today-available-row">
          <button
            type="button"
            className="mac-desktop-shell-today-edit-button"
            data-action="add"
            aria-label={`Add ${widget.name}`}
            onClick={() => onAdd(widget.id)}
          />
          <span>{widget.name}</span>
        </div>
      ))}
    </section>
  );
}

export const WORLD_CLOCKS = [
  { city: "Cupertino", zone: "America/Los_Angeles" },
  { city: "New York", zone: "America/New_York" },
  { city: "London", zone: "Europe/London" },
  { city: "Tokyo", zone: "Asia/Tokyo" },
] as const;

/** The zones the person chose for World Clock, each one the browser knows. */
export const WORLD_CLOCK_ZONES = "today.worldClocks";
const MOST_CLOCKS = 4;
const MOST_FOUND = 6;
const DEFAULT_ZONES: readonly string[] = WORLD_CLOCKS.map(({ zone }) => zone);

const knownZone = (zone: unknown): zone is string => {
  if (typeof zone !== "string") return false;
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: zone });
    return true;
  } catch {
    return false;
  }
};

export const readClockZones = (stored: unknown): readonly string[] | undefined => {
  if (!Array.isArray(stored)) return undefined;
  const zones = stored.filter(knownZone).slice(0, MOST_CLOCKS);
  return zones.length > 0 ? zones : undefined;
};

/** The name a zone goes by: the capital's own for those the widget starts with, else its city. */
export const cityOfZone = (zone: string) =>
  WORLD_CLOCKS.find((each) => each.zone === zone)?.city ??
  (zone.split("/").at(-1) ?? zone).replaceAll("_", " ");

/** The zones of the browser whose city starts or holds `query`, without those already `taken`. */
export function citiesMatching(query: string, taken: readonly string[]): readonly string[] {
  const wanted = query.trim().toLowerCase();
  if (wanted === "") return [];
  return Intl.supportedValuesOf("timeZone")
    .filter((zone) => !taken.includes(zone) && cityOfZone(zone).toLowerCase().includes(wanted))
    .sort(
      (a, b) =>
        Number(cityOfZone(b).toLowerCase().startsWith(wanted)) -
        Number(cityOfZone(a).toLowerCase().startsWith(wanted)),
    )
    .slice(0, MOST_FOUND);
}
/** A zone's wall clock at `at`, and how it stands to the browser's: "Today, +3HRS". */
export function zoneClock(at: number, zone: string) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: zone,
    hourCycle: "h23",
    year: "numeric",
    month: "numeric",
    day: "numeric",
    hour: "numeric",
    minute: "numeric",
  }).formatToParts(at);
  const part = (type: Intl.DateTimeFormatPartTypes) =>
    Number(parts.find((each) => each.type === type)?.value);
  const hours = part("hour");
  const minutes = part("minute");
  const wall = Date.UTC(part("year"), part("month") - 1, part("day"), hours, minutes);
  const here = new Date(at);
  const hereWall = Date.UTC(
    here.getFullYear(),
    here.getMonth(),
    here.getDate(),
    here.getHours(),
    here.getMinutes(),
  );
  const difference = (wall - hereWall) / 3_600_000;
  const days =
    (Date.UTC(part("year"), part("month") - 1, part("day")) -
      Date.UTC(here.getFullYear(), here.getMonth(), here.getDate())) /
    86_400_000;
  const day = days > 0 ? "Tomorrow" : days < 0 ? "Yesterday" : "Today";
  const sign = difference > 0 ? "+" : "−";
  const size = Math.abs(difference);
  return {
    hours,
    minutes,
    note: difference === 0 ? day : `${day}, ${sign}${size}${size === 1 ? "HR" : "HRS"}`,
  };
}

/** What the person pinned from Siri: the words as they were, for Today to show. */
export const TODAY_PINS = "today.siriPins";
const MOST_PINS = 8;
/** A setting holds at most 4096 bytes. */
const PIN_BYTES = 4_000;

interface TodayPin {
  id: string;
  asked: string;
  text: string;
}

const NO_PINS: readonly TodayPin[] = [];

const readPins = (stored: unknown): readonly TodayPin[] | undefined =>
  Array.isArray(stored)
    ? stored.filter(
        (each): each is TodayPin =>
          typeof each?.id === "string" &&
          typeof each?.asked === "string" &&
          typeof each?.text === "string",
      )
    : undefined;

/** Siri's Add to Today, whole, or `false` when a setting has no room for it beside the others. */
export function pinToToday(asked: string, text: string): boolean {
  const pins = readPins(desktopValues()[TODAY_PINS]) ?? NO_PINS;
  const next = [...pins, { id: crypto.randomUUID(), asked, text }];
  if (
    next.length > MOST_PINS ||
    new TextEncoder().encode(JSON.stringify(next)).length > PIN_BYTES
  ) {
    return false;
  }
  changeDesktopValue(TODAY_PINS, next);
  return true;
}

/** Requests `siri/commands.rs` only reads for, whole: asking one again can repeat no action. */
const ONLY_READS =
  /^(?:what time is it|what(?:'s| is) the time|(?:what(?:'s| is) the )?current time|tell me the time|what(?:'s| is) the date(?: today)?|what day is it|what(?:'s| is) today's date|what(?:'s| is) on my calendar(?: today| tomorrow)?|what(?:'s| is) on my list)[.?!]*$/i;

/** Whether a pin is asked again rather than kept as it was said. */
export const pinStaysLive = (asked: string) => ONLY_READS.test(asked.trim().replace(/’/g, "'"));

/** How often a live pin is asked again while Today shows it. */
const PIN_REFRESH_MS = 60_000;

/** Siri's words today, or `null` when the answer did not come or did more than read. */
async function askAgain(asked: string): Promise<string | null> {
  try {
    const reply = await withDeadline(async (signal) => {
      const response = await sessionFetch("/api/siri/ask", {
        method: "POST",
        credentials: "same-origin",
        headers: { "content-type": "application/json", "idempotency-key": crypto.randomUUID() },
        body: JSON.stringify({ text: asked, tz: 0 - new Date().getTimezoneOffset() }),
        signal,
      });
      return response.ok
        ? ((await response.json()) as {
            text?: unknown;
            via?: unknown;
            understood?: unknown;
            made?: unknown;
            effects?: unknown;
          })
        : null;
    });
    return reply &&
      typeof reply.text === "string" &&
      reply.via === "commands" &&
      reply.understood !== false &&
      !reply.made &&
      (!Array.isArray(reply.effects) || reply.effects.length === 0)
      ? reply.text
      : null;
  } catch {
    return null;
  }
}

/** A pin's words: read again while they are shown when asking only reads, and otherwise as kept. */
function PinWords({ asked, text }: { asked: string; text: string }) {
  const [words, setWords] = useState(text);
  useEffect(() => {
    if (!pinStaysLive(asked)) return;
    let shown = true;
    const read = () =>
      void askAgain(asked).then((answer) => {
        if (shown && answer !== null) setWords(answer);
      });
    read();
    const timer = setInterval(read, PIN_REFRESH_MS);
    return () => {
      shown = false;
      clearInterval(timer);
    };
  }, [asked]);
  return <p className="mac-desktop-shell-today-empty">{words}</p>;
}

/** What was pinned from Siri, at the end of Today, each until it is removed. */
export function TodayPins() {
  const [pins, setPins] = useDesktopSetting(TODAY_PINS, readPins, NO_PINS);
  return (
    <>
      {pins.map((pin) => (
        <TodayWidget key={pin.id} title={pin.asked}>
          <div className="mac-desktop-shell-today-cities">
            <PinWords asked={pin.asked} text={pin.text} />
            <PushButton
              size="small"
              aria-label={`Remove ${pin.asked}`}
              onClick={() => setPins(pins.filter((each) => each.id !== pin.id))}
            >
              Remove
            </PushButton>
          </div>
        </TodayWidget>
      ))}
    </>
  );
}

/** The World Clock widget: a face for each city, kept right while the panel is open. */
export function WorldClocks({ now }: { now: () => number }) {
  const [at, setAt] = useState(now);
  const [zones, setZones] = useDesktopSetting(WORLD_CLOCK_ZONES, readClockZones, DEFAULT_ZONES);
  const [choosing, setChoosing] = useState(false);
  const [query, setQuery] = useState("");
  useEffect(() => {
    const timer = setInterval(() => setAt(now()), 15_000);
    return () => clearInterval(timer);
  }, [now]);
  return (
    <>
      <ul className="mac-desktop-shell-today-clocks">
        {zones.map((zone) => {
          const { hours, minutes, note } = zoneClock(at, zone);
          const center = 22;
          return (
            <li key={zone}>
              <svg
                viewBox="0 0 44 44"
                role="img"
                aria-label={`${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}`}
                className="mac-desktop-shell-today-clock"
                data-night={hours < 6 || hours >= 18 ? "" : undefined}
              >
                <circle cx={center} cy={center} r="21" />
                <path
                  d="M22 22V11"
                  strokeWidth="2.5"
                  transform={`rotate(${(hours % 12) * 30 + minutes / 2} ${center} ${center})`}
                />
                <path
                  d="M22 22V6"
                  strokeWidth="1.5"
                  transform={`rotate(${minutes * 6} ${center} ${center})`}
                />
              </svg>
              <span className="mac-desktop-shell-today-clock-city">{cityOfZone(zone)}</span>
              <span className="mac-desktop-shell-today-detail">{note}</span>
            </li>
          );
        })}
      </ul>
      {choosing ? (
        <div className="mac-desktop-shell-today-cities">
          {zones.map((zone) => (
            <div key={zone} className="mac-desktop-shell-today-city">
              <span>{cityOfZone(zone)}</span>
              <PushButton
                size="small"
                aria-label={`Remove ${cityOfZone(zone)}`}
                disabled={zones.length === 1}
                onClick={() => setZones(zones.filter((each) => each !== zone))}
              >
                Remove
              </PushButton>
            </div>
          ))}
          {zones.length < MOST_CLOCKS ? (
            <>
              <TextField
                aria-label="Find a city"
                placeholder="Find a city"
                value={query}
                onValueChange={setQuery}
              />
              {citiesMatching(query, zones).map((zone) => (
                <div key={zone} className="mac-desktop-shell-today-city">
                  <span>{cityOfZone(zone)}</span>
                  <PushButton
                    size="small"
                    aria-label={`Add ${cityOfZone(zone)}`}
                    onClick={() => {
                      setZones([...zones, zone]);
                      setQuery("");
                    }}
                  >
                    Add
                  </PushButton>
                </div>
              ))}
            </>
          ) : (
            <p className="mac-desktop-shell-today-empty">The widget holds four cities.</p>
          )}
          <PushButton size="small" onClick={() => setChoosing(false)}>
            Done
          </PushButton>
        </div>
      ) : (
        <div className="mac-desktop-shell-today-cities">
          <PushButton size="small" onClick={() => setChoosing(true)}>
            Choose Cities…
          </PushButton>
        </div>
      )}
    </>
  );
}

const KEYS: readonly { label: string; name?: string; wide?: boolean; action: CalculatorAction }[] =
  [
    { label: "±", name: "Negate", action: { type: "negate" } },
    { label: "%", name: "Percent", action: { type: "percent" } },
    { label: "÷", name: "Divide", action: { type: "operator", operator: "divide" } },
    ...["7", "8", "9"].map((digit) => ({
      label: digit,
      action: { type: "digit", digit } as const,
    })),
    { label: "×", name: "Multiply", action: { type: "operator", operator: "multiply" } },
    ...["4", "5", "6"].map((digit) => ({
      label: digit,
      action: { type: "digit", digit } as const,
    })),
    { label: "−", name: "Subtract", action: { type: "operator", operator: "subtract" } },
    ...["1", "2", "3"].map((digit) => ({
      label: digit,
      action: { type: "digit", digit } as const,
    })),
    { label: "+", name: "Add", action: { type: "operator", operator: "add" } },
    { label: "0", wide: true, action: { type: "digit", digit: "0" } },
    { label: ".", name: "Decimal point", action: { type: "decimal" } },
    { label: "=", name: "Equals", action: { type: "equals" } },
  ];

/** The Calculator widget, on the arithmetic of the Calculator application. */
export function TodayCalculator() {
  const [state, press] = useReducer(reduce, initialCalculatorState);
  const clear = state.clearable ? "C" : "AC";
  return (
    <div className="mac-desktop-shell-today-calculator">
      <output className="mac-desktop-shell-today-calculator-display">{displayText(state)}</output>
      <button type="button" onClick={() => press({ type: "clear" })}>
        {clear}
      </button>
      {KEYS.map((key) => (
        <button
          key={key.label}
          type="button"
          aria-label={key.name}
          data-wide={key.wide ? "" : undefined}
          data-operator={
            key.action.type === "operator" || key.action.type === "equals" ? "" : undefined
          }
          onClick={() => press(key.action)}
        >
          {key.label}
        </button>
      ))}
    </div>
  );
}
