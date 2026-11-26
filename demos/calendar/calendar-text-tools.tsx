"use client";

import { useRef, useState } from "react";
import { useDesktopSetting } from "../desktop/desktop-personal";
import { substituteTyped, useTextSubstitutions } from "../desktop/text-substitutions";
import {
  checkDocumentAfterMenu,
  SpellingItems,
  SpellingPanel,
  SubstitutionItems,
  SubstitutionsPanel,
  useLearnedWords,
} from "../desktop/text-tools";
import { SpeechItems } from "../notes/notes-edit-menu";

const readOn = (stored: unknown) => (typeof stored === "boolean" ? stored : undefined);

/** The text the tools work on: a view of several lines, as an event's notes are. */
const textViewOf = (target: EventTarget | null) =>
  target instanceof HTMLTextAreaElement ||
  (target instanceof HTMLElement && target.isContentEditable)
    ? target
    : null;

/**
 * Edit > Spelling and Grammar, Substitutions and Speech, for the multi-line text field the window
 * last had the keyboard in: an event's notes, a card's note. `app` names the kept settings and
 * `className` places the panels. Speech reads `spoken` when no field is there. Give `handlers` to the
 * window and show `panels` in it; `spelling` and `speech` are the menu's rows, `items` both.
 */
export function useTextTools(app: string, className: string, spoken: () => HTMLElement | null) {
  const field = useRef<HTMLElement | null>(null);
  // Set when a field takes the keyboard, so that the menu's rows are drawn anew.
  const [, setFocused] = useState<EventTarget | null>(null);
  const [panel, setPanel] = useState<"spelling" | "substitutions" | null>(null);
  const [substitutions, setSubstitutions] = useTextSubstitutions(app);
  const [whileTyping, setWhileTyping] = useDesktopSetting(
    `${app}.spellingWhileTyping`,
    readOn,
    true,
  );
  const { learned } = useLearnedWords();
  const ignored = useRef(new Set<string>());
  const current = () => (field.current?.isConnected ? field.current : null);
  const element = () => current();
  const noField = current() === null;

  const handlers = {
    onFocusCapture: (event: { target: EventTarget }) => {
      const view = textViewOf(event.target);
      if (!view) return;
      view.spellcheck = whileTyping;
      field.current = view;
      setFocused(view);
    },
    onInputCapture: (event: { target: EventTarget; nativeEvent: Event }) => {
      const view = textViewOf(event.target);
      const typed = event.nativeEvent as InputEvent;
      if (view && typed.inputType?.startsWith("insertText")) {
        substituteTyped(view, typed.data, substitutions, false);
      }
    },
  };

  const spelling = (
    <>
      <SpellingItems
        disabled={noField}
        whileTyping={whileTyping}
        onToggleWhileTyping={() => {
          setWhileTyping(!whileTyping);
          const view = current();
          if (view) view.spellcheck = !whileTyping;
        }}
        onShow={() => setPanel("spelling")}
        onCheckNow={() => checkDocumentAfterMenu(element, () => learned)}
      />
      <SubstitutionItems
        disabled={noField}
        settings={substitutions}
        onChange={setSubstitutions}
        onShow={() => setPanel("substitutions")}
      />
    </>
  );
  const speech = (
    <SpeechItems
      target={() => {
        const view = current() ?? spoken();
        return view
          ? { element: view, restore: () => view.focus(), editable: true, rich: false }
          : null;
      }}
    />
  );
  const items = (
    <>
      {spelling}
      {speech}
    </>
  );

  const panels =
    panel === "spelling" ? (
      <SpellingPanel
        className={className}
        element={element}
        editable
        ignored={ignored.current}
        onClose={() => setPanel(null)}
      />
    ) : panel === "substitutions" ? (
      <SubstitutionsPanel
        className={className}
        element={element}
        editable
        settings={substitutions}
        onChange={setSubstitutions}
        onClose={() => setPanel(null)}
      />
    ) : null;

  return { handlers, items, spelling, speech, panels };
}

/** The text tools of Calendar's window; Speech reads `spoken`, the selected event. */
export const useCalendarTextTools = (spoken: () => HTMLElement | null) =>
  useTextTools("calendar", "mac-calendar-floating-panel", spoken);
