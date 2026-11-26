"use client";

import { BorderlessButton } from "macalicious/borderless-button";
import { Siri, SiriCard } from "macalicious/siri";
import { TextField } from "macalicious/text-field";
import {
  type FormEvent,
  type PointerEvent,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from "react";
import "../siri/siri.tokens.css";
import "../siri/siri.css";
import { openFile, showInFinder } from "../finder/finder-open";
import { runSceneAnswer } from "../home/home-siri";
import { PlaceMap } from "../spotlight/spotlight-desktop";
import { siriSpeaks } from "../system-preferences/setting-effects";
import { beginDesktopDrag } from "./desktop-drag";
import { requestDesktopEffects } from "./desktop-effects";
import { openItem } from "./desktop-open-item";
import { requestDesktopOverlay } from "./desktop-overlay-requests";
import {
  changeDesktopValue,
  desktopValues,
  subscribeDesktopValues,
  useDesktopSetting,
} from "./desktop-personal";
import { sessionFetch, withDeadline } from "./desktop-server";
import { copyText } from "./desktop-share-link";
import {
  answerHere,
  CANCEL_THE_DRAFT,
  draftLetGo,
  followUp,
  SEND_THE_DRAFT,
  sendDraft,
} from "./desktop-siri-answers";
import {
  boundSiriPlace,
  type SiriRoom,
  siriListensIn,
  siriSpeaksIn,
} from "./desktop-siri-settings";
import { followDrag } from "./desktop-spaces-bar";
import {
  abandon,
  afterHeySiri,
  CANNOT_LISTEN,
  HEY_SIRI_REFUSED,
  HEY_SIRI_SETTING,
  listenWhileOpen,
  type Recognition,
  recognition,
} from "./desktop-speech";
import { pinToToday } from "./desktop-today-widgets";

/** Siri's module of the desktop's Ferrite application (`ferrite-apps/desktop/src/apps/siri`). */
export const SIRI_ASK_URL = "/api/siri/ask";

/** A card under Siri's answer. */
export interface SiriAnswerCard {
  title: string;
  /** The app that keeps what it lists (a demo folder id). */
  app: string;
  /** What the card says first, large: a price, a time, a word. */
  lead?: string;
  /** What goes under `lead`. */
  detail?: string;
  /** Where the place it speaks of is, drawn as a map. */
  map?: { lat: number; lon: number };
  items: { text: string; id?: string }[];
}

/** A message Siri has written and holds for the person to send or cancel. */
export interface SiriMailDraft {
  /** The account or address it goes to. */
  to: string;
  /** The person's name, as the answer says it. */
  name: string;
  subject: string;
  text: string;
  /** One key for the draft, so that pressing Send twice sends it once. */
  key: string;
}

/** What the server answers to a request. */
export interface SiriAnswer {
  text: string;
  card: SiriAnswerCard | null;
  effects: unknown;
  via: "commands" | "model";
  understood: boolean;
  /** A message that "send it" sends. */
  draft?: SiriMailDraft;
  /** What this answer made, which "change it to 5" changes. */
  made?: SiriMade;
}

/** A note, sticky, reminder or event Siri made. */
export interface SiriMade {
  app: string;
  id: string;
}

/** "Change it to 5": said after Siri made something, it goes to that thing, whatever it was. */
const CHANGES_WHAT_WAS_MADE =
  /^(?:please |hey siri,? |siri,? )?(?:change|move|make) (?:it|that)\b.*\S/i;

/** The requests Siri lists before anything is asked. */
export const SIRI_EXAMPLES = [
  "What’s on my calendar today?",
  "Remind me to call Mom at 5 PM tomorrow",
  "Make a note that says Buy flowers",
  "Turn on dark mode",
  "Open Calculator",
] as const;

/** How many earlier answers stay in the window. */
const EARLIER_KEPT = 20;

const OPEN_THAT = /^open (?:it|that|the first one)[.!]?$/i;

/** Where Siri's window has been moved from its corner, kept per account. */
const SIRI_PLACE = "siri.place";
interface SiriPlace {
  x: number;
  y: number;
}
const HOME: SiriPlace = Object.freeze({ x: 0, y: 0 });
const readPlace = (stored: unknown): SiriPlace | undefined => {
  const { x, y } = (stored ?? {}) as Partial<SiriPlace>;
  return Number.isFinite(x) && Number.isFinite(y) ? { x: x as number, y: y as number } : undefined;
};
const CONTROLS = "button, input, textarea, a, [role='button']";
const MENU_BAR_HEIGHT = 22;
/** How much of the window stays above the bottom of the screen. */
const KEPT_ON_SCREEN = 60;

/** A server reply read as an answer, or `null` when it is not one. */
export function answerOf(value: unknown): SiriAnswer | null {
  const reply = value as Partial<SiriAnswer> | null;
  if (!reply || typeof reply.text !== "string") return null;
  const card = reply.card as Partial<SiriAnswerCard> | null | undefined;
  const goodCard =
    card &&
    typeof card.title === "string" &&
    typeof card.app === "string" &&
    Array.isArray(card.items)
      ? {
          title: card.title,
          app: card.app,
          ...(typeof card.lead === "string" ? { lead: card.lead } : {}),
          ...(typeof card.detail === "string" ? { detail: card.detail } : {}),
          items: card.items
            .filter((item): item is { text: string; id?: string } => typeof item?.text === "string")
            .slice(0, 8),
        }
      : null;
  return {
    text: reply.text,
    card: goodCard,
    effects: reply.effects ?? [],
    via: reply.via === "model" ? "model" : "commands",
    understood: reply.understood !== false,
    ...(typeof reply.made?.app === "string" && typeof reply.made.id === "string"
      ? { made: { app: reply.made.app, id: reply.made.id } }
      : {}),
  };
}

/** Ask the server. Never throws: a failure is an answer that says so. One key per request, so a
 * retry of the same request (by the browser or the platform) is answered once. With `made`, the
 * request is about that thing. */
export async function askSiri(text: string, made?: SiriMade): Promise<SiriAnswer> {
  const key =
    typeof crypto !== "undefined" && "randomUUID" in crypto
      ? crypto.randomUUID()
      : `${Date.now()}-${Math.random().toString(36).slice(2)}`;
  try {
    return await withDeadline(async (signal) => {
      const response = await sessionFetch(SIRI_ASK_URL, {
        method: "POST",
        credentials: "same-origin",
        headers: { "content-type": "application/json", "idempotency-key": key },
        body: JSON.stringify({
          text,
          tz: 0 - new Date().getTimezoneOffset(),
          ...(made ? { made } : {}),
        }),
        signal,
      });
      const body = await response.json().catch(() => null);
      const answer = response.ok ? answerOf(body) : null;
      if (answer) return answer;
      const message =
        (body as { error?: unknown } | null)?.error ?? `the server answered ${response.status}`;
      return failed(`Sorry, something went wrong: ${String(message)}.`);
    });
  } catch {
    return failed("Sorry, I can’t reach the desktop’s server right now. Try again in a moment.");
  }
}

const failed = (text: string): SiriAnswer => ({
  text,
  card: null,
  effects: [],
  via: "commands",
  understood: false,
});

/** The answer for a recognizer that could not listen: nothing was heard, typing still works. */
export const CANNOT_HEAR = "I can’t hear you right now; type your request instead.";

/**
 * A request with nothing before it to answer to: a Home scene it asks for, what the desktop answers
 * itself, or the server; a scene's name alone, when the server did not understand.
 */
async function answerPlainly(meant: string): Promise<SiriAnswer> {
  const scene = await runSceneAnswer(meant).catch(() => null);
  if (scene) return scene;
  const reply =
    (await answerHere(meant).catch(() =>
      failed("Sorry, something went wrong. Try again in a moment."),
    )) ?? (await askSiri(meant));
  if (reply.understood) return reply;
  return (await runSceneAnswer(meant, true).catch(() => null)) ?? reply;
}

function speak(text: string) {
  try {
    if (typeof window === "undefined" || !("speechSynthesis" in window)) return;
    window.speechSynthesis.cancel();
    const words = new SpeechSynthesisUtterance(text);
    const values = desktopValues();
    const lang = siriSpeaksIn(values["siri.language"], values["siri.voice"]);
    if (lang) words.lang = lang;
    window.speechSynthesis.speak(words);
  } catch {
    // Speaking is a courtesy; the answer is on the screen.
  }
}

/** Stop an answer being spoken: a new request replaces it, and a closed Siri says nothing. */
function hush() {
  try {
    if (typeof window !== "undefined" && "speechSynthesis" in window) {
      window.speechSynthesis.cancel();
    }
  } catch {
    // Nothing was being spoken.
  }
}

const HEY_SIRI_EVENT = "macalicious:hey-siri";
/** What was said after "Hey Siri" before the window was open: the window takes it as it opens. */
let saidBeforeOpening: string | null = null;

/**
 * Listens for "Hey Siri" while this page is open and the pane's setting is on and Siri is not off.
 * The words after it go to Siri as a spoken request; with none, Siri opens and listens. Answers the
 * function that stops.
 */
export function startHeySiri(): () => void {
  let stop: (() => void) | null = null;
  const hear = (said: string) => {
    const request = afterHeySiri(said);
    if (request === null) return;
    const told = new CustomEvent(HEY_SIRI_EVENT, { cancelable: true, detail: request });
    window.dispatchEvent(told);
    if (told.defaultPrevented) return;
    saidBeforeOpening = request;
    requestDesktopOverlay("siri");
  };
  const follow = () => {
    const values = desktopValues();
    const wanted = values[HEY_SIRI_SETTING] === true && values["siri.askSiri"] !== false;
    if (wanted && !stop) {
      stop = listenWhileOpen({
        hear,
        lang: () => siriListensIn(desktopValues()["siri.language"]),
        refused: (reason) => {
          stop = null;
          changeDesktopValue(HEY_SIRI_REFUSED, reason);
          changeDesktopValue(HEY_SIRI_SETTING, false);
        },
      });
    } else if (!wanted && stop) {
      stop();
      stop = null;
    }
  };
  const stopFollowing = subscribeDesktopValues(follow);
  follow();
  return () => {
    stopFollowing();
    stop?.();
    stop = null;
  };
}

export interface DesktopSiriProps {
  /** Close the window. */
  onClose: () => void;
  /** Open an application (the desktop's launcher), for a card's Open button. */
  launch: (id: string) => void;
}

/**
 * Siri on the desktop when the `macalicious-desktop` Ferrite application serves it: a request
 * typed in the Type to Siri field, chosen among the examples, or spoken (where the browser
 * recognises speech) goes to the server, which acts on the person's own notes, reminders,
 * calendar and the rest, and answers. What the answer asks of the desktop (open an app, switch
 * the appearance) is carried out by the desktop (`desktop-effects.ts`).
 */
export function DesktopSiri({ onClose, launch }: DesktopSiriProps) {
  const [typed, setTyped] = useState("");
  const [asked, setAsked] = useState<string | null>(null);
  const [answer, setAnswer] = useState<SiriAnswer | null>(null);
  // What was asked and answered before, oldest first, while the window is open.
  const [earlier, setEarlier] = useState<
    readonly { asked: string; text: string; card: SiriAnswerCard | null }[]
  >([]);
  const [savedPlace, savePlace] = useDesktopSetting(SIRI_PLACE, readPlace, HOME);
  const [dragged, setDragged] = useState<SiriPlace | null>(null);
  const frame = useRef<HTMLDivElement>(null);
  const [room, setRoom] = useState<SiriRoom | null>(null);
  const wanted = dragged ?? savedPlace;
  const place = room ? boundSiriPlace(wanted, room) : wanted;
  const shown = useRef(place);
  shown.current = place;
  // A place kept on a larger screen, or a screen that shrinks, must leave the window in reach.
  useLayoutEffect(() => {
    const element = frame.current;
    if (!element) return undefined;
    const measure = () => {
      const { left, right, top } = element.getBoundingClientRect();
      const { x, y } = shown.current;
      setRoom({
        minX: x - left,
        maxX: x + window.innerWidth - right,
        minY: y - top + MENU_BAR_HEIGHT,
        maxY: y - top + window.innerHeight - KEPT_ON_SCREEN,
      });
    };
    measure();
    window.addEventListener("resize", measure);
    const sized = typeof ResizeObserver === "undefined" ? null : new ResizeObserver(measure);
    sized?.observe(element);
    return () => {
      window.removeEventListener("resize", measure);
      sized?.disconnect();
    };
  }, []);
  const [busy, setBusy] = useState(false);
  const [listening, setListening] = useState(false);
  const [help, setHelp] = useState(false);
  const listener = useRef<Recognition | null>(null);
  // Only the newest request's answer is shown.
  const latest = useRef(0);
  // What the last request meant, in full: what a follow-up to it takes up.
  const lastMeant = useRef<string | null>(null);
  // What Siri made last in this conversation: what "change it" changes.
  const lastMade = useRef<SiriMade | null>(null);
  const [pinNote, setPinNote] = useState<string | null>(null);
  // False once the window has closed: nothing is shown or heard after that.
  const alive = useRef(true);

  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
      hush();
      const heard = listener.current;
      listener.current = null;
      if (heard) abandon(heard);
    };
  }, []);

  const openCardItem = (app: string, id: string, text: string) => {
    if (app === "finder") {
      if (!openFile({ id, name: text })) showInFinder({ id });
    } else {
      openItem({ app, id, title: text });
      launch(app);
    }
    onClose();
  };

  const ask = async (text: string, spoken: boolean) => {
    const request = text.trim();
    if (!request || !alive.current) return;
    const ticket = latest.current + 1;
    latest.current = ticket;
    hush();
    // Typed while a recognizer listens: the request typed is the one that counts.
    if (!spoken && listener.current) {
      abandon(listener.current);
      listener.current = null;
      setListening(false);
    }
    if (asked && answer) {
      const past = { asked, text: answer.text, card: answer.card };
      setEarlier((all) => [...all, past].slice(-EARLIER_KEPT));
    }
    setAsked(request);
    setHelp(false);
    setBusy(true);
    setPinNote(null);
    const shownCard = answer?.card;
    const shownDraft = answer?.draft;
    setAnswer(null);
    // "Open it" is the first thing the answer before listed.
    const first = shownCard?.items.find((item) => item.id);
    if (OPEN_THAT.test(request) && shownCard && first) {
      openCardItem(shownCard.app, first.id as string, first.text);
      return;
    }
    const meant = followUp(request, lastMeant.current);
    lastMeant.current = meant;
    const made = CHANGES_WHAT_WAS_MADE.test(request) ? lastMade.current : null;
    const reply = made
      ? await askSiri(request, made)
      : shownDraft && SEND_THE_DRAFT.test(request)
        ? await sendDraft(shownDraft)
        : shownDraft && CANCEL_THE_DRAFT.test(request)
          ? draftLetGo()
          : await answerPlainly(meant);
    if (reply.made && latest.current === ticket) lastMade.current = reply.made;
    // The server has already done what it answers: the desktop carries out its part even when a
    // newer request has replaced this answer, or the window has closed.
    requestDesktopEffects(reply.effects);
    if (latest.current !== ticket || !alive.current) return;
    setBusy(false);
    setAnswer(reply);
    if (spoken && siriSpeaks()) speak(reply.text);
  };

  const submit = (event: FormEvent) => {
    event.preventDefault();
    const text = typed;
    setTyped("");
    void ask(text, false);
  };

  const listen = () => {
    if (listening) {
      // Stopped by the person: what was heard so far still arrives, as the request.
      try {
        listener.current?.stop();
      } catch {
        // Already stopped.
      }
      setListening(false);
      return;
    }
    // A recognizer still finishing from before is dropped, unheard, before a new one starts.
    const previous = listener.current;
    listener.current = null;
    if (previous) abandon(previous);
    // Nothing is said while the microphone listens, and an answer still on its way is not shown
    // or spoken over what the person says next (its effects still run: `ask`).
    hush();
    latest.current += 1;
    setBusy(false);
    const heard = recognition();
    if (!heard) {
      // No speech recognition in this browser: typing works everywhere.
      setAnswer(failed("This browser can’t hear you; type your request instead."));
      setAsked(null);
      return;
    }
    listener.current = heard;
    // Only the current recognizer of an open Siri is listened to.
    const current = () => alive.current && listener.current === heard;
    const cannotHear = () => {
      listener.current = null;
      setListening(false);
      setAsked(null);
      setAnswer(failed(CANNOT_HEAR));
    };
    heard.lang = siriListensIn(desktopValues()["siri.language"]) ?? (navigator.language || "en-US");
    heard.interimResults = false;
    heard.onresult = (event) => {
      if (!current()) return;
      const transcript = event.results[0]?.[0]?.transcript ?? "";
      void ask(transcript, true);
    };
    heard.onend = () => {
      if (!current()) return;
      listener.current = null;
      setListening(false);
    };
    heard.onerror = (event) => {
      if (!current()) return;
      if (CANNOT_LISTEN.has(event?.error ?? "")) cannotHear();
      else {
        listener.current = null;
        setListening(false);
      }
    };
    setListening(true);
    setAsked(null);
    setAnswer(null);
    try {
      heard.start();
    } catch {
      if (current()) cannotHear();
    }
  };

  // "Hey Siri": what was said before the window opened, and what is said while it is open.
  const spokenTo = useRef({ ask, listen });
  spokenTo.current = { ask, listen };
  useEffect(() => {
    const take = (request: string) => {
      if (request) void spokenTo.current.ask(request, true);
      else spokenTo.current.listen();
    };
    if (saidBeforeOpening !== null) {
      const request = saidBeforeOpening;
      saidBeforeOpening = null;
      take(request);
    }
    const hear = (event: Event) => {
      event.preventDefault();
      take((event as CustomEvent<string>).detail);
    };
    window.addEventListener(HEY_SIRI_EVENT, hear);
    return () => window.removeEventListener(HEY_SIRI_EVENT, hear);
  }, []);

  // Moved by any part of it that is not a control, and kept for the account.
  const moveFrom = (down: PointerEvent<HTMLDivElement>) => {
    if (down.button !== 0 || (down.target as Element).closest(CONTROLS)) return;
    const from = place;
    let last = from;
    followDrag(
      down.nativeEvent,
      (move) => {
        const raw = {
          x: from.x + move.clientX - down.clientX,
          y: from.y + move.clientY - down.clientY,
        };
        last = room ? boundSiriPlace(raw, room) : raw;
        setDragged(last);
      },
      (up, started) => {
        setDragged(null);
        if (up && started) savePlace(last);
      },
    );
  };

  const fileItem = (
    app: string,
    { id, text }: { id: string; text: string },
  ): ((down: PointerEvent<HTMLElement>) => void) | undefined =>
    app === "finder"
      ? (down) => {
          if (down.button !== 0) return;
          beginDesktopDrag(down.nativeEvent, {
            from: "siri",
            items: () => [{ id, name: text, kind: "file" }],
            // Out of the way of what it is dragged to.
            onStart: onClose,
          });
        }
      : undefined;

  const itemRows = (card: SiriAnswerCard) => (
    <ul className="mac-desktop-shell-siri-list">
      {card.items.map((item, index) => {
        const { id, text } = item;
        return (
          // biome-ignore lint/suspicious/noArrayIndexKey: one answer's items never move
          <li key={index}>
            {id ? (
              <BorderlessButton
                onPointerDown={fileItem(card.app, { id, text })}
                onClick={() => openCardItem(card.app, id, text)}
              >
                {text}
              </BorderlessButton>
            ) : (
              text
            )}
          </li>
        );
      })}
    </ul>
  );

  const examples =
    !busy && !listening && (help || (!answer && asked === null) || answer?.understood === false);
  const prompt = listening
    ? "Listening…"
    : asked
      ? `“${asked}”`
      : help
        ? "Some things you can ask me:"
        : "What can I help you with?";

  return (
    <div
      ref={frame}
      className="mac-desktop-shell-siri"
      style={{ translate: `${place.x}px ${place.y}px` }}
      onPointerDown={moveFrom}
    >
      <Siri
        prompt={prompt}
        listening={listening}
        onListen={listen}
        onHelp={() => setHelp((shown) => !shown)}
        onClose={onClose}
        style={{ height: 360 }}
      >
        {/* The window is dark in both appearances, so the field in it is drawn in Dark Aqua. */}
        <form className="mac-siri-demo-type" data-appearance="dark" onSubmit={submit}>
          <TextField
            bezel="rounded"
            aria-label="Type to Siri"
            placeholder="Type to Siri"
            autoComplete="off"
            autoFocus
            value={typed}
            onValueChange={setTyped}
            style={{ width: "100%" }}
          />
        </form>
        {earlier.length > 0 ? (
          <ul className="mac-desktop-shell-siri-earlier" aria-label="Earlier answers">
            {earlier.map((past, index) => (
              // biome-ignore lint/suspicious/noArrayIndexKey: this list only grows at its end
              <li key={index}>
                <span>“{past.asked}”</span> {past.text}
                {past.card && past.card.items.length > 0 ? itemRows(past.card) : null}
              </li>
            ))}
          </ul>
        ) : null}
        {busy ? <p className="mac-siri-demo-reply">…</p> : null}
        {answer ? (
          <p className="mac-siri-demo-reply" data-answer="">
            {answer.text}
          </p>
        ) : null}
        {answer ? (
          <p className="mac-siri-demo-reply">
            <BorderlessButton
              onClick={() =>
                void copyText(answer.text).then((copied) =>
                  setPinNote(copied ? "Copied." : "The browser refused to copy this."),
                )
              }
            >
              Copy
            </BorderlessButton>{" "}
            {asked ? (
              <BorderlessButton
                onClick={() =>
                  setPinNote(
                    pinToToday(asked, answer.text)
                      ? "Added to Today."
                      : "Today has no room for this. Remove something from it first.",
                  )
                }
              >
                Add to Today
              </BorderlessButton>
            ) : null}{" "}
            {pinNote ? <span role="status">{pinNote}</span> : null}
          </p>
        ) : null}
        {answer?.draft ? (
          <SiriCard title="Mail" icon={<span className="mac-siri-demo-icon" />}>
            <p className="mac-desktop-shell-siri-detail">To: {answer.draft.name}</p>
            {answer.draft.subject ? (
              <p className="mac-desktop-shell-siri-detail">Subject: {answer.draft.subject}</p>
            ) : null}
            <p className="mac-desktop-shell-siri-lead">{answer.draft.text}</p>
            <div className="mac-siri-demo-result">
              <BorderlessButton onClick={() => void ask("Cancel it", false)}>
                Cancel
              </BorderlessButton>{" "}
              <BorderlessButton onClick={() => void ask("Send it", false)}>Send</BorderlessButton>
            </div>
          </SiriCard>
        ) : null}
        {answer?.card ? (
          <SiriCard title={answer.card.title} icon={<span className="mac-siri-demo-icon" />}>
            {answer.card.lead ? (
              <p className="mac-desktop-shell-siri-lead">{answer.card.lead}</p>
            ) : null}
            {answer.card.detail ? (
              <p className="mac-desktop-shell-siri-detail">{answer.card.detail}</p>
            ) : null}
            {answer.card.map ? (
              <PlaceMap
                lat={answer.card.map.lat}
                lon={answer.card.map.lon}
                name={answer.card.lead ?? answer.card.title}
              />
            ) : null}
            {answer.card.items.length > 0 ? itemRows(answer.card) : null}
            {answer.card.app !== "siri" ? (
              <div className="mac-siri-demo-result">
                <BorderlessButton
                  onClick={() => {
                    launch(answer.card?.app ?? "");
                    onClose();
                  }}
                >
                  Open {answer.card.title}
                </BorderlessButton>
              </div>
            ) : null}
          </SiriCard>
        ) : null}
        {examples ? (
          <ul className="mac-siri-demo-examples" aria-label="Example requests">
            {SIRI_EXAMPLES.map((example) => (
              <li key={example} className="mac-siri-demo-example">
                <BorderlessButton onClick={() => void ask(example, false)}>
                  “{example}”
                </BorderlessButton>
              </li>
            ))}
          </ul>
        ) : null}
      </Siri>
    </div>
  );
}
