"use client";

import { BorderlessButton } from "macalicious/borderless-button";
import { Label } from "macalicious/label";
import { ScrollView } from "macalicious/scroll-view";
import { Segment, SegmentedControl } from "macalicious/segmented-control";
import { TextField } from "macalicious/text-field";
import { useCallback, useRef, useState } from "react";
import { formatDistance, type LatLon, type Units } from "./maps-geo";
import { currentPosition } from "./maps-location";
import {
  type Answer,
  askRoute,
  type RouteStep,
  type ServedPlace,
  type ServedRoute,
  searchPlaces,
  type TravelMode,
} from "./maps-server";
import type { MapLayer } from "./maps-tiles";

/** What the start field holds until the person changes it. */
export const CURRENT_LOCATION = "Current Location";

const NO_TRANSIT = "The routing service this desktop asks has no public transport.";
/** The usage policy of the FOSSGIS routers asks for this link beside their routes. */
const FIX_THE_MAP = "https://www.openstreetmap.org/fixthemap";

/** An end of the journey: what its field says, and the place found for it. */
export interface Ending {
  text: string;
  place: ServedPlace | null;
}

const endingOf = (place: ServedPlace): Ending => ({ text: place.name, place });
const typed = (text: string): Ending => ({ text, place: null });

/** What the panel shows under the fields. */
export type RouteState =
  | { kind: "idle" }
  | { kind: "asking" }
  | { kind: "route"; route: ServedRoute }
  | { kind: "none" }
  | { kind: "failed"; message: string };

/** "12 min", or "1 hr 5 min". */
export function formatDuration(seconds: number): string {
  const minutes = Math.max(1, Math.round(seconds / 60));
  if (minutes < 60) return `${minutes} min`;
  const rest = minutes % 60;
  const hours = `${Math.floor(minutes / 60)} hr`;
  return rest === 0 ? hours : `${hours} ${rest} min`;
}

/** How long to wait before asking again when the search's one-a-second turn was taken. */
const SEARCH_RETRY_MS = 1_100;
/** How many times a place is looked up before saying the search is busy. */
const SEARCH_ATTEMPTS = 4;

/**
 * The point an end of the journey is at: looked up by its text, unless a place is already known.
 * Two ends typed in a row share the search's one request a second, so a refused turn (429) waits
 * and asks again, unless the question `stale` says has since changed.
 */
async function pointOf(
  ending: Ending,
  near: LatLon,
  stale: () => boolean,
  lookup: typeof searchPlaces,
): Promise<Answer<LatLon>> {
  if (ending.place) return { ok: true, value: ending.place };
  if (ending.text === CURRENT_LOCATION) {
    const answer = await currentPosition();
    return "problem" in answer
      ? { ok: false, status: 0, message: answer.problem }
      : { ok: true, value: answer.at };
  }
  let found = await lookup(ending.text.trim(), near);
  for (let attempt = 1; attempt < SEARCH_ATTEMPTS; attempt += 1) {
    if (found.ok || found.status !== 429 || stale()) break;
    await new Promise((resolve) => setTimeout(resolve, SEARCH_RETRY_MS));
    if (stale()) break;
    found = await lookup(ending.text.trim(), near);
  }
  if (!found.ok) return found;
  const first = found.value[0];
  return first
    ? { ok: true, value: first }
    : { ok: false, status: 0, message: `“${ending.text.trim()}” could not be found` };
}

/** The state of a Directions panel, and what asks it for a route. */
export function useDirections(near: LatLon, onRoute: (route: ServedRoute) => void) {
  const [start, setStart] = useState<Ending>(typed(CURRENT_LOCATION));
  const [end, setEnd] = useState<Ending>(typed(""));
  const [mode, setMode] = useState<TravelMode>("driving");
  const [state, setState] = useState<RouteState>({ kind: "idle" });
  // The newest question: any change of the journey asks a new one, so an answer to an older
  // question, or a start looked up for one, is never shown.
  const asked = useRef(0);
  // Share only identical requests while they are in flight. A completed lookup is never cached,
  // so a later question can still reflect a changed location or updated provider data.
  const searches = useRef(new Map<string, Promise<Answer<ServedPlace[]>>>());
  const routes = useRef(new Map<string, Promise<Answer<ServedRoute | null>>>());

  const ask = useCallback(
    async (from: Ending, to: Ending, how: TravelMode) => {
      const question = ++asked.current;
      if (from.text.trim() === "" || to.text.trim() === "") {
        setState({ kind: "idle" });
        return;
      }
      setState({ kind: "asking" });
      const fail = (message: string) => setState({ kind: "failed", message });
      const stale = () => question !== asked.current;
      const lookup: typeof searchPlaces = (text, around) => {
        const key = JSON.stringify([text, around?.lat.toFixed(6), around?.lon.toFixed(6)]);
        const held = searches.current.get(key);
        if (held) return held;
        const request = searchPlaces(text, around).finally(() => searches.current.delete(key));
        searches.current.set(key, request);
        return request;
      };
      const first = await pointOf(from, near, stale, lookup);
      if (stale()) return;
      if (!first.ok) return fail(first.message);
      const second = await pointOf(to, near, stale, lookup);
      if (stale()) return;
      if (!second.ok) return fail(second.message);
      const routeKey = JSON.stringify([
        first.value.lat.toFixed(6),
        first.value.lon.toFixed(6),
        second.value.lat.toFixed(6),
        second.value.lon.toFixed(6),
        how,
      ]);
      let request = routes.current.get(routeKey);
      if (!request) {
        request = askRoute(first.value, second.value, how).finally(() =>
          routes.current.delete(routeKey),
        );
        routes.current.set(routeKey, request);
      }
      const answer = await request;
      if (stale()) return;
      if (!answer.ok) return fail(answer.message);
      if (answer.value === null) return setState({ kind: "none" });
      setState({ kind: "route", route: answer.value });
      onRoute(answer.value);
    },
    [near, onRoute],
  );

  return {
    start,
    end,
    mode,
    state,
    /** The panel was left: what is on its way no longer answers anything. */
    forget: () => {
      asked.current += 1;
      setState((current) => (current.kind === "asking" ? { kind: "idle" } : current));
    },
    /** A field's text changed: what it said no longer has an answer. */
    edit: (which: "start" | "end", text: string) => {
      asked.current += 1;
      setState({ kind: "idle" });
      (which === "start" ? setStart : setEnd)(typed(text));
    },
    /** Return in a field. */
    go: () => void ask(start, end, mode),
    swap: () => {
      setStart(end);
      setEnd(start);
      void ask(end, start, mode);
    },
    chooseMode: (next: TravelMode) => {
      setMode(next);
      void ask(start, end, next);
    },
    /** Directions to a place, from the start the panel has. */
    to: (place: ServedPlace) => {
      const next = endingOf(place);
      setEnd(next);
      void ask(start, next, mode);
    },
    /** Directions from a place, to the end the panel has. */
    from: (place: ServedPlace) => {
      const next = endingOf(place);
      setStart(next);
      void ask(next, end, mode);
    },
  };
}

export type Directions = ReturnType<typeof useDirections>;

interface DirectionsPanelProps {
  directions: Directions;
  units: Units;
  /** The step last chosen, whose row reads as selected. */
  chosenStep: RouteStep | null;
  onChooseStep: (step: RouteStep) => void;
}

const MODES: readonly { value: TravelMode | "transit"; label: string }[] = [
  { value: "driving", label: "Drive" },
  { value: "walking", label: "Walk" },
  { value: "transit", label: "Transit" },
];

/** The panel beside the map: the two ends, the way of travelling, the route and its steps. */
export function DirectionsPanel({
  directions,
  units,
  chosenStep,
  onChooseStep,
}: DirectionsPanelProps) {
  const { start, end, mode, state } = directions;
  const field = (which: "start" | "end", label: string, ending: Ending) => (
    <TextField
      aria-label={label}
      placeholder={label}
      value={ending.text}
      autoCapitalize="off"
      autoCorrect="off"
      spellCheck={false}
      onValueChange={(value) => directions.edit(which, String(value))}
      onKeyDown={(event) => {
        if (event.key === "Enter") directions.go();
      }}
    />
  );
  return (
    <aside className="mac-maps-journey" aria-label="Directions">
      <div className="mac-maps-journey-ends">
        <div className="mac-maps-journey-fields">
          {field("start", "Start", start)}
          {field("end", "End", end)}
        </div>
        <BorderlessButton aria-label="Swap Start and End" onClick={directions.swap}>
          ⇅
        </BorderlessButton>
      </div>
      <SegmentedControl
        aria-label="How to travel"
        className="mac-maps-journey-modes"
        value={[mode]}
        onValueChange={(values) => {
          const next = values.at(-1);
          if (next === "driving" || next === "walking") directions.chooseMode(next);
        }}
      >
        {MODES.map((item) => (
          <Segment
            key={item.value}
            value={item.value}
            disabled={item.value === "transit"}
            title={item.value === "transit" ? NO_TRANSIT : undefined}
          >
            {item.label}
          </Segment>
        ))}
      </SegmentedControl>
      <div className="mac-maps-journey-answer" role="status">
        {state.kind === "asking" ? (
          <Label textStyle="small" color="secondary">
            Finding a route…
          </Label>
        ) : null}
        {state.kind === "none" ? (
          <Label textStyle="small">No route was found between these places.</Label>
        ) : null}
        {state.kind === "failed" ? (
          <Label textStyle="small">{`No route: ${state.message}`}</Label>
        ) : null}
        {state.kind === "route" ? (
          <Label className="mac-maps-journey-summary">
            {`${formatDuration(state.route.duration_s)} · ${formatDistance(state.route.distance_m, units)}`}
          </Label>
        ) : null}
      </div>
      <ScrollView className="mac-maps-journey-steps">
        {state.kind === "route" ? (
          <ol className="mac-maps-journey-list">
            {state.route.steps.map((step) => (
              <li key={`${step.lat},${step.lon},${step.text}`}>
                <button
                  type="button"
                  className="mac-maps-journey-step"
                  data-chosen={step === chosenStep ? "" : undefined}
                  onClick={() => onChooseStep(step)}
                >
                  <span>{step.text}</span>
                  {step.distance_m > 0 ? (
                    <span className="mac-maps-journey-step-distance">
                      {formatDistance(step.distance_m, units)}
                    </span>
                  ) : null}
                </button>
              </li>
            ))}
          </ol>
        ) : null}
      </ScrollView>
      <Label textStyle="mini" color="secondary" className="mac-maps-journey-credit">
        Routes by FOSSGIS, from © OpenStreetMap contributors.{" "}
        <a href={FIX_THE_MAP} target="_blank" rel="noreferrer">
          Fix the map
        </a>
      </Label>
    </aside>
  );
}

/** A route's line over the map, with its two ends. */
export function RouteLine({ route, layer }: { route: ServedRoute; layer: MapLayer }) {
  const points = route.path.map((point) => layer.project(point));
  const first = points[0];
  const last = points.at(-1);
  if (!first || !last) return null;
  return (
    <svg
      className="mac-maps-route"
      width={layer.width}
      height={layer.height}
      aria-hidden="true"
      focusable="false"
    >
      <polyline points={points.map((point) => `${point.x},${point.y}`).join(" ")} />
      <circle cx={first.x} cy={first.y} r={5} data-end="start" />
      <circle cx={last.x} cy={last.y} r={5} data-end="end" />
    </svg>
  );
}
