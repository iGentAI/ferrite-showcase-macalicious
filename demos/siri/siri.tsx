"use client";

import { BorderlessButton } from "macalicious/borderless-button";
import { cn } from "macalicious/lib/cn";
import { Siri, SiriCard, type SiriProps } from "macalicious/siri";
import { TextField } from "macalicious/text-field";
import { type FormEvent, useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import {
  answerScrollTop,
  CONDITION_NAMES,
  defaultRequests,
  FORECASTS,
  GREETING,
  HELP_HEADING,
  NOT_UNDERSTOOD,
  nextRequest,
  type SiriAnswerCard,
  type SiriCapture,
  type SiriCondition,
  type SiriForecast,
  type SiriRequest,
  understand,
} from "./siri-data";
import "./siri.tokens.css";
import "./siri.css";

/** How long the orb listens before the demo "hears" a request, in milliseconds. */
export const LISTEN_DURATION = 2400;

export interface SiriAssistantProps
  extends Omit<SiriProps, "prompt" | "listening" | "onListen" | "onHelp" | "children"> {
  /**
   * Which reference capture's forecast the Weather card shows: the Aqua capture's (95°, from
   * 4 PM) or the Dark Aqua capture's (73°, from 12 PM). The window itself is the same in both.
   * @default "light"
   */
  capture?: SiriCapture;
  /**
   * The requests the window can answer, in the order the orb "hears" them.
   * @default defaultRequests
   */
  requests?: readonly SiriRequest[];
  /**
   * Id of the request that is answered when the window is first shown. `null`, or an id that
   * names no request, shows Siri's own prompt instead.
   * @default "weather"
   */
  defaultRequest?: string | null;
  /**
   * Shows a text field under the prompt to type a request in, as the Type to Siri setting of
   * macOS does. The field then stays in view: an answer is not scrolled to the top.
   * @default false
   */
  typeToSiri?: boolean;
  /**
   * How long the orb listens before a request is "heard" and answered, in milliseconds.
   * @default 2400
   */
  listenDuration?: number;
  /** Whether the window is shown (controlled). A window that is not shown renders nothing. */
  open?: boolean;
  /**
   * Whether the window is shown at first (uncontrolled).
   * @default true
   */
  defaultOpen?: boolean;
  /** Called with `false` when the close button or Escape closes the window. */
  onOpenChange?: (open: boolean) => void;
  /**
   * Called with a request when it is answered: typed, chosen among the examples, or "heard".
   * A host opens the application a request names in `opens` here.
   */
  onAnswer?: (request: SiriRequest) => void;
}

/** What the results show. */
type View =
  | { kind: "greeting" }
  | { kind: "help" }
  | { kind: "answer"; request: SiriRequest }
  | { kind: "unknown" };

const GREETING_VIEW: View = { kind: "greeting" };

/** A plain shape in place of a weather glyph, which is Apple's artwork. */
function Glyph({
  condition,
  large,
  named,
}: {
  condition: SiriCondition;
  large?: boolean;
  named?: boolean;
}) {
  // Day is a filled shape and night its outline; a clear sky is a circle, clouds a square.
  const night = condition.endsWith("night");
  const paint = night
    ? { fill: "none", stroke: "currentColor", strokeWidth: 3 }
    : { fill: "currentColor" };
  const shape =
    condition === "sunny" || condition === "clear-night" ? (
      <circle cx="9" cy="9" r={night ? 6.5 : 8} {...paint} />
    ) : (
      <rect
        x={night ? 2.5 : 1}
        y={night ? 2.5 : 1}
        width={night ? 13 : 16}
        height={night ? 13 : 16}
        rx="3"
        {...paint}
      />
    );
  const size = large ? "large" : undefined;
  return named ? (
    <svg
      className="mac-siri-demo-glyph"
      data-size={size}
      viewBox="0 0 18 18"
      role="img"
      aria-label={CONDITION_NAMES[condition]}
    >
      {shape}
    </svg>
  ) : (
    <svg className="mac-siri-demo-glyph" data-size={size} viewBox="0 0 18 18" aria-hidden="true">
      {shape}
    </svg>
  );
}

/** The body of the Weather snippet: the summary block, then one row for each hour. */
function Weather({ forecast }: { forecast: SiriForecast }) {
  return (
    <>
      <div className="mac-siri-demo-summary">
        {/* The first line under the city names the condition, so this glyph is decoration. */}
        <Glyph condition={forecast.condition} large />
        <div className="mac-siri-demo-conditions">
          <p className="mac-siri-demo-city">{forecast.city}</p>
          {forecast.lines.map((line) => (
            <p key={line} className="mac-siri-demo-line">
              {line}
            </p>
          ))}
        </div>
        <p className="mac-siri-demo-temperature">{forecast.temperature}°</p>
      </div>
      <ul className="mac-siri-demo-hours" aria-label="Hourly forecast">
        {forecast.hours.map((hour) => (
          <li key={hour.hour} className="mac-siri-demo-hour">
            <span className="mac-siri-demo-hour-label">{hour.hour}</span>
            <Glyph condition={hour.condition} named />
            <span className="mac-siri-demo-degrees">{hour.degrees}</span>
          </li>
        ))}
      </ul>
    </>
  );
}

/** The body of a card that answers with one value. */
function Value({ card }: { card: Extract<SiriAnswerCard, { kind: "value" }> }) {
  return (
    <div className="mac-siri-demo-result">
      <p className="mac-siri-demo-caption">{card.caption}</p>
      <p className="mac-siri-demo-value">{card.value}</p>
      {card.detail ? <p className="mac-siri-demo-caption">{card.detail}</p> : null}
    </div>
  );
}

/**
 * Siri as macOS 10.15 shows it, answering with the Weather result of the reference captures:
 * the library's `Siri` window and `SiriCard` with a small assistant behind them. A request is
 * typed (with `typeToSiri`), chosen among the examples the help button lists, or "heard": the
 * orb listens for `listenDuration` and then answers the next request of its list. Nothing is
 * listened to and nothing is looked up; the requests and their answers are data.
 *
 * The root is the library's `Siri`, which takes every prop that is not listed here: `style`,
 * `className`, `ref`, `onClose`, `level`, `animated` and the accessible names.
 */
export function SiriAssistant({
  capture = "light",
  requests = defaultRequests,
  defaultRequest = "weather",
  typeToSiri = false,
  listenDuration = LISTEN_DURATION,
  open: openProp,
  defaultOpen = true,
  onOpenChange,
  onAnswer,
  onClose,
  className,
  ref,
  ...props
}: SiriAssistantProps) {
  const [ownOpen, setOwnOpen] = useState(defaultOpen);
  const open = openProp ?? ownOpen;

  const [view, setView] = useState<View>(() => {
    const request = requests.find((candidate) => candidate.id === defaultRequest);
    return request ? { kind: "answer", request } : GREETING_VIEW;
  });
  const [listening, setListening] = useState(false);
  // The request answered last: the orb "hears" the one after it. A window that is not shown
  // at first has answered nothing yet.
  const [lastId, setLastId] = useState(
    open && view.kind === "answer" ? view.request.id : undefined,
  );
  const [typed, setTyped] = useState("");

  // Siri listens when it is invoked: a window that is shown again starts over, listening. The
  // window that is there at first shows its answer, as the captures do.
  const [wasOpen, setWasOpen] = useState(open);
  if (open !== wasOpen) {
    setWasOpen(open);
    setListening(open);
    if (open) setView(GREETING_VIEW);
  }

  const answer = (request: SiriRequest) => {
    setListening(false);
    setView({ kind: "answer", request });
    setLastId(request.id);
    onAnswer?.(request);
  };

  // Listening ends by itself: the demo "hears" the next request of the list and answers it.
  // What the timer reads when it fires is kept here, so that a host that renders again while
  // Siri listens does not start the wait over.
  const heard = useRef(() => {});
  useEffect(() => {
    heard.current = () => {
      const request = nextRequest(requests, lastId);
      if (request) answer(request);
      else setListening(false);
    };
  });
  useEffect(() => {
    if (!listening) return;
    const timer = setTimeout(() => heard.current(), listenDuration);
    return () => clearTimeout(timer);
  }, [listening, listenDuration]);

  // The window that is shown again takes the keyboard, so that Escape closes it; the one
  // that is there when the page loads leaves the focus where it is.
  const root = useRef<HTMLDivElement | null>(null);
  const setRoot = useCallback(
    (element: HTMLDivElement | null) => {
      root.current = element;
      if (typeof ref === "function") {
        // A callback ref may return its own cleanup (React 19); it is handed on.
        const cleanup = ref(element);
        if (typeof cleanup === "function") {
          return () => {
            root.current = null;
            cleanup();
          };
        }
      } else if (ref) ref.current = element;
    },
    [ref],
  );
  const shownAtFirst = useRef(open);
  useEffect(() => {
    if (open && !shownAtFirst.current) root.current?.focus({ preventScroll: true });
    if (!open) shownAtFirst.current = false;
  }, [open]);

  // An answer taller than the results is scrolled until its card is at the top, as in both
  // captures, and again whenever the results or the card change size (the window is resized,
  // a font arrives). Results without a card, and the results under the text field, are
  // scrolled back to the top, so the prompt and the field are in view.
  const card = useRef<HTMLElement>(null);
  // biome-ignore lint/correctness/useExhaustiveDependencies: the view, the listening state and the forecast decide which card there is and how tall it is.
  useLayoutEffect(() => {
    const region = root.current?.querySelector<HTMLElement>(".mac-siri-results");
    if (!region) return;
    const place = () => {
      const element = card.current;
      if (typeToSiri || !element || !region.contains(element)) {
        region.scrollTop = 0;
        return;
      }
      const top =
        element.getBoundingClientRect().top - region.getBoundingClientRect().top + region.scrollTop;
      region.scrollTop = answerScrollTop(top, region.scrollHeight, region.clientHeight);
    };
    place();
    if (typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver(place);
    observer.observe(region);
    if (card.current) observer.observe(card.current);
    return () => observer.disconnect();
  }, [view, open, typeToSiri, listening, capture]);

  if (!open) return null;

  const close = () => {
    setOwnOpen(false);
    onOpenChange?.(false);
    onClose?.();
  };

  const listen = () => {
    if (!listening) setView(GREETING_VIEW);
    setListening(!listening);
  };

  const help = () => {
    setListening(false);
    setView(view.kind === "help" ? GREETING_VIEW : { kind: "help" });
  };

  const submit = (event: FormEvent) => {
    event.preventDefault();
    if (typed.trim() === "") return;
    const request = understand(typed, requests);
    setTyped("");
    if (request) return answer(request);
    setListening(false);
    setView({ kind: "unknown" });
  };

  const request = view.kind === "answer" && !listening ? view.request : undefined;
  const examples = !listening && (view.kind === "help" || view.kind === "unknown");
  const prompt = request
    ? `“${request.phrase}”`
    : !listening && view.kind === "help"
      ? HELP_HEADING
      : GREETING;
  const reply = request?.reply ?? (examples && view.kind === "unknown" ? NOT_UNDERSTOOD : null);

  return (
    <Siri
      tabIndex={-1}
      {...props}
      ref={setRoot}
      className={cn("mac-siri-demo", className)}
      prompt={prompt}
      listening={listening}
      onListen={listen}
      onHelp={help}
      onClose={close}
    >
      {typeToSiri ? (
        // The window is dark in both appearances, so the field in it is drawn in Dark Aqua.
        <form className="mac-siri-demo-type" data-appearance="dark" onSubmit={submit}>
          <TextField
            bezel="rounded"
            aria-label="Type to Siri"
            placeholder="Type to Siri"
            autoComplete="off"
            value={typed}
            onValueChange={setTyped}
            style={{ width: "100%" }}
          />
        </form>
      ) : null}
      {reply ? <p className="mac-siri-demo-reply">{reply}</p> : null}
      {examples ? (
        <ul className="mac-siri-demo-examples" aria-label="Example requests">
          {requests.map((example) => (
            <li key={example.id} className="mac-siri-demo-example">
              <BorderlessButton
                onClick={() => {
                  // The button goes away with the list: the window takes the keyboard, so that
                  // the focus is not lost and Escape still closes Siri.
                  root.current?.focus({ preventScroll: true });
                  answer(example);
                }}
              >
                “{example.phrase}”
              </BorderlessButton>
            </li>
          ))}
        </ul>
      ) : null}
      {request?.card ? (
        <SiriCard
          ref={card}
          title={request.card.title}
          icon={<span className="mac-siri-demo-icon" />}
        >
          {request.card.kind === "weather" ? (
            <Weather forecast={FORECASTS[capture]} />
          ) : (
            <Value card={request.card} />
          )}
        </SiriCard>
      ) : null}
    </Siri>
  );
}
