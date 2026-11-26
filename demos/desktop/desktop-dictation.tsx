"use client";

import {
  Alert,
  AlertButtons,
  AlertClose,
  AlertInformativeText,
  AlertMessage,
  AlertPopup,
} from "macalicious/alert";
import { DefaultButton } from "macalicious/default-button";
import { MenuItem } from "macalicious/menu-item";
import { PushButton } from "macalicious/push-button";
import { useEffect, useLayoutEffect, useRef, useState, useSyncExternalStore } from "react";
import {
  DICTATION_LANGUAGE,
  DICTATION_ON,
} from "../system-preferences/panes/keyboard/dictation-settings";
import { onceFree, writableField } from "./desktop-edit-rows";
import { changeDesktopValue, desktopValues } from "./desktop-personal";
import { siriListensIn } from "./desktop-siri-settings";
import {
  abandon,
  CANNOT_LISTEN,
  offersSpeechRecognition,
  type Recognition,
  recognition,
} from "./desktop-speech";
import { flatOffsetBefore, flatText } from "./text-spelling";
import "./desktop-dictation.css";

/*
 * Edit > Start Dictation: what the browser's speech recognition hears goes in at the insertion point
 * of the field that had the keyboard, while a small panel says it listens. Done lets what was already
 * said arrive; Escape, or the keyboard going elsewhere, ends it at once. Dictation starts off, as on a
 * Mac: until it is enabled, the row and the pane's On ask first.
 */

export const NO_SPEECH_SERVICE =
  "Dictation needs a speech service, which this browser doesn’t have.";
export const NO_TEXT_FIELD = "Dictation types into a text field. Click in one first.";
export const CANNOT_HEAR_DICTATION =
  "Dictation can’t hear you. The browser refused the microphone, or its speech service can’t be reached.";
const NOT_TAKEN = "This field did not take the words.";

const PANEL = ".mac-desktop-dictation";
const MENUS = '[role="menu"], [role="menubar"], [aria-haspopup="menu"]';

/** How the panel stands off from the insertion point and the edges of the screen. */
const PANEL_MARGIN = 6;

/** What the text before the insertion point asks of the words heard: a capital, a space before them. */
export function typedForm(before: string, heard: string): string {
  const words = heard.trim();
  if (!words) return "";
  const startsSentence = before.trim() === "" || /[.!?\n]\s*$/.test(before);
  const shown = startsSentence ? words.charAt(0).toLocaleUpperCase() + words.slice(1) : words;
  return before === "" || /\s$/.test(before) ? shown : ` ${shown}`;
}

/**
 * What a recognizer's results hold beyond the `taken` already typed: the finished stretches to type, in
 * order, and the words still changing, to show. A recognizer repeats all its results at every event.
 */
export function newlyHeard(
  results: ArrayLike<ArrayLike<{ transcript: string }> & { isFinal?: boolean }>,
  taken: number,
): { finished: string[]; changing: string } {
  const finished: string[] = [];
  let changing = "";
  for (let at = taken; at < results.length; at += 1) {
    const result = results[at];
    const transcript = result?.[0]?.transcript ?? "";
    if (result?.isFinal && changing === "") finished.push(transcript);
    else changing += transcript;
  }
  return { finished, changing };
}

/** Where the panel stands: under `anchor`, over it when there is no room, always on the screen. */
export function panelPlace(
  anchor: { left: number; top: number; bottom: number },
  panel: { width: number; height: number },
  screen: { width: number; height: number },
): { left: number; top: number } {
  const under = anchor.bottom + PANEL_MARGIN;
  const top =
    under + panel.height + PANEL_MARGIN <= screen.height
      ? under
      : Math.max(PANEL_MARGIN, anchor.top - PANEL_MARGIN - panel.height);
  const left = Math.min(anchor.left, screen.width - panel.width - PANEL_MARGIN);
  return { left: Math.max(PANEL_MARGIN, left), top };
}

interface DictationView {
  /** What it is hearing now, which may yet change. */
  changing: string;
  /** Why nothing more goes in. */
  problem: string | null;
  /** Done was pressed: only what was already said is still to come. */
  finishing: boolean;
}

interface Session {
  heard: Recognition;
  field: HTMLElement;
  /** Where rich text's insertion point was, until the field has the keyboard back. */
  caret: Range | null;
  /** How many of the recognizer's results have been typed. */
  taken: number;
  /** Finished words waiting for the field to have the keyboard: a menu may hold it for a moment. */
  held: string[];
  stop: () => void;
}

let session: Session | null = null;
let view: DictationView | null = null;
/** The prompt that offers to enable Dictation, with the field and insertion point it took the keyboard from. */
let offer: { field: HTMLElement | null; caret: Range | null } | null = null;
const listeners = new Set<() => void>();

const subscribe = (listener: () => void) => {
  listeners.add(listener);
  return () => listeners.delete(listener);
};
const readView = () => view;
const readOffer = () => offer;

function tell() {
  for (const listener of listeners) listener();
}

function show(next: DictationView | null) {
  view = next;
  tell();
}

const change = (part: Partial<DictationView>) => {
  if (view) show({ ...view, ...part });
};

function textBeforeCaret(field: HTMLElement): string {
  if (field instanceof HTMLInputElement || field instanceof HTMLTextAreaElement) {
    return field.value.slice(0, field.selectionStart ?? field.value.length);
  }
  const selection = field.ownerDocument.getSelection();
  if (!selection?.rangeCount) return flatText(field).text;
  const { startContainer, startOffset } = selection.getRangeAt(0);
  if (!field.contains(startContainer)) return flatText(field).text;
  return flatText(field).text.slice(0, flatOffsetBefore(field, startContainer, startOffset));
}

function caretIn(field: HTMLElement): Range | null {
  if (!field.isContentEditable) return null;
  const selection = field.ownerDocument.getSelection();
  if (!selection?.rangeCount) return null;
  const range = selection.getRangeAt(0);
  return field.contains(range.startContainer) ? range.cloneRange() : null;
}

function putCaret(caret: Range) {
  const selection = document.getSelection();
  selection?.removeAllRanges();
  selection?.addRange(caret);
}

function typeHeld(now: Session) {
  if (now.held.length === 0 || document.activeElement !== now.field) return;
  if (now.caret) {
    putCaret(now.caret);
    now.caret = null;
  }
  for (const words of now.held.splice(0)) {
    const text = typedForm(textBeforeCaret(now.field), words);
    if (text && !document.execCommand("insertText", false, text)) {
      change({ problem: NOT_TAKEN });
      return;
    }
  }
}

function finish(ending: Session) {
  if (session !== ending) return;
  session = null;
  ending.stop();
  abandon(ending.heard);
  show(null);
}

/** Done: what was already said still arrives. Pressed again, or when nothing is coming, it ends here. */
export function stopDictation() {
  if (!session) return;
  if (!view || view.finishing || view.problem) {
    finish(session);
    return;
  }
  change({ finishing: true, changing: "" });
  try {
    session.heard.stop();
  } catch {
    finish(session);
  }
}

function watchKeyboard(now: Session): () => void {
  const onFocus = (event: FocusEvent) => {
    const target = event.target as Element;
    if (target === now.field) typeHeld(now);
    else if (!target.closest(`${MENUS}, ${PANEL}`)) finish(now);
  };
  const onPress = (event: Event) => {
    if ((event.target as Element).closest(`${MENUS}, ${PANEL}`)) return;
    setTimeout(() => {
      if (document.activeElement !== now.field) finish(now);
    });
  };
  const onKey = (event: KeyboardEvent) => {
    if (event.key !== "Escape" || document.querySelector('[role="menu"][data-open]')) return;
    event.preventDefault();
    event.stopPropagation();
    finish(now);
  };
  document.addEventListener("focusin", onFocus, true);
  document.addEventListener("pointerdown", onPress, true);
  document.addEventListener("keydown", onKey, true);
  return () => {
    document.removeEventListener("focusin", onFocus, true);
    document.removeEventListener("pointerdown", onPress, true);
    document.removeEventListener("keydown", onKey, true);
  };
}

/** Edit > Start Dictation, for the field that had the keyboard when the menu took it. */
export function startDictation() {
  const field = writableField();
  const heard = recognition();
  if (session || !field || !heard) return;
  const now: Session = {
    heard,
    field,
    caret: caretIn(field),
    taken: 0,
    held: [],
    stop: () => {},
  };
  session = now;
  now.stop = watchKeyboard(now);
  heard.lang =
    siriListensIn(desktopValues()[DICTATION_LANGUAGE]) ?? (navigator.language || "en-US");
  heard.interimResults = true;
  heard.continuous = true;
  heard.onresult = (event) => {
    const { finished, changing } = newlyHeard(event.results, now.taken);
    now.taken += finished.length;
    now.held.push(...finished);
    change({ changing });
    typeHeld(now);
  };
  heard.onerror = (event) => {
    if (CANNOT_LISTEN.has(event?.error ?? "")) {
      change({ problem: CANNOT_HEAR_DICTATION, changing: "" });
    }
  };
  heard.onend = () => {
    // The panel stays to say why nothing was heard.
    if (view?.problem) return;
    typeHeld(now);
    if (now.held.length === 0) finish(now);
    else
      onceFree(now.field, () => {
        typeHeld(now);
        finish(now);
      });
  };
  show({ changing: "", problem: null, finishing: false });
  try {
    heard.start();
  } catch {
    change({ problem: CANNOT_HEAR_DICTATION });
  }
  onceFree(field, () => typeHeld(now));
}

/** What Start Dictation and the pane's On do while Dictation is off: ask, as a Mac does. */
export function offerDictation() {
  const field = writableField();
  offer = { field, caret: field && caretIn(field) };
  tell();
}

function answerOffer(enable: boolean) {
  if (!offer) return;
  const { field, caret } = offer;
  offer = null;
  tell();
  if (enable) changeDesktopValue(DICTATION_ON, true);
  if (!field?.isConnected) return;
  // After the prompt has gone: the keyboard cannot go back to the field while the prompt holds it.
  setTimeout(() => {
    field.focus();
    if (caret) putCaret(caret);
    if (enable) startDictation();
  });
}

function EnableDictation() {
  return (
    <Alert open onOpenChange={(open) => !open && answerOffer(false)}>
      <AlertPopup finalFocus={false}>
        <AlertMessage>Do you want to enable Dictation?</AlertMessage>
        <AlertInformativeText>
          When you use Dictation, this browser’s speech recognition hears what you say, and some
          browsers send it to their maker. You can turn Dictation off in System Preferences &gt;
          Keyboard &gt; Dictation.
        </AlertInformativeText>
        <AlertButtons>
          <AlertClose>Cancel</AlertClose>
          <AlertClose render={<DefaultButton />} onClick={() => answerOffer(true)}>
            Enable Dictation
          </AlertClose>
        </AlertButtons>
      </AlertPopup>
    </Alert>
  );
}

export function DictationRow() {
  const listening = useSyncExternalStore(subscribe, readView, () => null) !== null;
  if (listening) return <MenuItem onClick={stopDictation}>Stop Dictation</MenuItem>;
  const reason = !offersSpeechRecognition()
    ? NO_SPEECH_SERVICE
    : !writableField()
      ? NO_TEXT_FIELD
      : null;
  return reason ? (
    <MenuItem disabled title={reason} data-reason={reason}>
      Start Dictation…
    </MenuItem>
  ) : (
    <MenuItem onClick={desktopValues()[DICTATION_ON] === true ? startDictation : offerDictation}>
      Start Dictation…
    </MenuItem>
  );
}

function anchorOf(field: HTMLElement): DOMRect {
  const selection = field.isContentEditable ? document.getSelection() : null;
  const range = selection?.rangeCount ? selection.getRangeAt(0) : null;
  const box = range && field.contains(range.startContainer) ? range.getBoundingClientRect() : null;
  return box && box.height > 0 ? box : field.getBoundingClientRect();
}

/** The floating panel, while dictation runs. The desktop holds one. */
export function DesktopDictation() {
  const now = useSyncExternalStore(subscribe, readView, () => null);
  const offered = useSyncExternalStore(subscribe, readOffer, () => null) !== null;
  const frame = useRef<HTMLDivElement>(null);
  const [place, setPlace] = useState<{ left: number; top: number } | null>(null);
  const open = now !== null;
  useLayoutEffect(() => {
    const panel = frame.current;
    if (!open || !panel || !session) {
      setPlace(null);
      return;
    }
    setPlace(
      panelPlace(
        anchorOf(session.field),
        { width: panel.offsetWidth, height: panel.offsetHeight },
        { width: window.innerWidth, height: window.innerHeight },
      ),
    );
  }, [open]);
  useEffect(
    () => () => {
      if (session) finish(session);
      offer = null;
    },
    [],
  );
  if (!now) return offered ? <EnableDictation /> : null;
  return (
    // Pressing the panel leaves the keyboard in the field being dictated into.
    <div
      ref={frame}
      className="mac-desktop-dictation"
      role="dialog"
      aria-label="Dictation"
      data-state={now.problem ? "stopped" : "listening"}
      style={place ?? { visibility: "hidden" }}
      onMouseDown={(event) => event.preventDefault()}
    >
      <svg className="mac-desktop-dictation-mic" viewBox="0 0 24 24" aria-hidden="true">
        <rect x="9" y="3" width="6" height="12" rx="3" fill="currentColor" />
        <path
          d="M6 11a6 6 0 0 0 12 0M12 17v4M9 21h6"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.6"
          strokeLinecap="round"
        />
      </svg>
      <p className="mac-desktop-dictation-words" role="status">
        {now.problem ?? (now.changing || (now.finishing ? "Finishing…" : "Listening…"))}
      </p>
      <PushButton size="small" onClick={stopDictation}>
        Done
      </PushButton>
    </div>
  );
}
