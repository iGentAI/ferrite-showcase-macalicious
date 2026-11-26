"use client";

import { MenuSeparator } from "macalicious/menu-item";
import { type FormEvent, useCallback, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { readBoolean, useDesktopSetting } from "../desktop/desktop-personal";
import {
  smartQuote,
  type TextSubstitutions,
  useTextSubstitutions,
} from "../desktop/text-substitutions";
import {
  SpellingItems,
  SpellingPanel,
  SubstitutionItems,
  SubstitutionsPanel,
} from "../desktop/text-tools";
import { SpeechItems } from "../notes/notes-edit-menu";
import type { Reminder } from "./reminders-data";

const SPELLING_WHILE_TYPING = "reminders.spellingWhileTyping";

/**
 * What a character typed in a field of one line does: a straight quote turns curly and two hyphens a
 * dash. The field holds the character already. The desktop's `substituteTyped` reads the caret from
 * a text area or rich text only.
 */
export function substituteInField(
  field: HTMLInputElement,
  typed: string | null | undefined,
  settings: TextSubstitutions,
): void {
  const caret = field.selectionStart;
  if (caret === null || !typed) return;
  const before = field.value.slice(0, caret);
  if (settings.quotes && (typed === '"' || typed === "'")) {
    field.setRangeText(smartQuote(before.slice(0, -1), typed), caret - 1, caret, "end");
  } else if (settings.dashes && typed === "-" && before.endsWith("--")) {
    field.setRangeText("—", caret - 2, caret, "end");
  }
}

/** What a reminder's title and notes fields take from Edit's Spelling and Substitutions. */
export function useReminderFieldTyping() {
  const [spellCheck] = useDesktopSetting(SPELLING_WHILE_TYPING, readBoolean, true);
  const [settings] = useTextSubstitutions("reminders");
  const onInput = useCallback(
    (event: FormEvent<HTMLInputElement>) => {
      substituteInField(event.currentTarget, (event.nativeEvent as InputEvent).data, settings);
    },
    [settings],
  );
  return useMemo(() => ({ spellCheck, onInput }), [spellCheck, onInput]);
}

/** Title and notes as one text the panels read, the title on its first line. */
const toolText = (reminder: Reminder) =>
  reminder.notes ? `${reminder.title}\n${reminder.notes}` : reminder.title;

/**
 * Edit > Spelling and Grammar, Substitutions and Speech, on the selected reminder. A press on the
 * menu bar ends an edit in a field, as nothing else can keep it open here, so these act on the
 * reminder's title and notes: Show Spelling goes through their words in its panel and Check Document
 * Now opens it, as a word selected in no visible text could not be seen.
 */
export function useRemindersTextTools({
  reminder,
  spoken,
  onChange,
  hidden,
}: {
  /** The reminder the commands read from. */
  reminder: Reminder | undefined;
  /** The titles Start Speaking says: those of the selection. */
  spoken: string;
  onChange: (id: string, change: { title: string; notes?: string }) => void;
  /** The panels stay out of sight while the window is not active. */
  hidden: boolean;
}) {
  const [whileTyping, setWhileTyping] = useDesktopSetting(SPELLING_WHILE_TYPING, readBoolean, true);
  const [settings, setSettings] = useTextSubstitutions("reminders");
  const [spelling, setSpelling] = useState(false);
  const [substitutions, setSubstitutions] = useState(false);
  const ignored = useRef(new Set<string>());
  const text = useRef<HTMLTextAreaElement>(null);
  const element = useCallback(() => text.current, []);
  const disabled = !reminder;
  const items = (
    <>
      <MenuSeparator />
      <SpellingItems
        disabled={disabled}
        whileTyping={whileTyping}
        onToggleWhileTyping={() => setWhileTyping(!whileTyping)}
        onShow={() => setSpelling(true)}
        onCheckNow={() => setSpelling(true)}
      />
      <SubstitutionItems
        disabled={disabled}
        settings={settings}
        onChange={setSettings}
        onShow={() => setSubstitutions(true)}
      />
      <SpeechItems
        target={() => {
          if (!spoken) return null;
          const words = document.createElement("textarea");
          words.value = spoken;
          return { element: words, restore: () => {}, editable: false, rich: false };
        }}
      />
    </>
  );
  const panels =
    (spelling || substitutions) && typeof document !== "undefined"
      ? createPortal(
          <div className="mac-reminders-tool-panels" data-hidden={hidden ? "" : undefined}>
            {reminder ? (
              <textarea
                ref={text}
                className="mac-reminders-hidden"
                aria-hidden="true"
                tabIndex={-1}
                value={toolText(reminder)}
                onChange={(event) => {
                  const typed = event.currentTarget.value;
                  const line = typed.indexOf("\n");
                  onChange(
                    reminder.id,
                    line < 0
                      ? { title: typed, notes: undefined }
                      : { title: typed.slice(0, line), notes: typed.slice(line + 1) },
                  );
                }}
              />
            ) : null}
            {spelling ? (
              <SpellingPanel
                key={reminder?.id}
                element={element}
                editable={!disabled}
                ignored={ignored.current}
                onClose={() => setSpelling(false)}
              />
            ) : null}
            {substitutions ? (
              <SubstitutionsPanel
                element={element}
                editable={!disabled}
                settings={settings}
                onChange={setSettings}
                onClose={() => setSubstitutions(false)}
              />
            ) : null}
          </div>,
          document.body,
        )
      : null;
  return { items, panels };
}
