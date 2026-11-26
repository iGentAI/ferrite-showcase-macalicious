"use client";

import { Checkbox } from "macalicious/checkbox";
import { DefaultButton } from "macalicious/default-button";
import { ListView } from "macalicious/list-view";
import { MenuCheckboxItem, MenuItem, MenuSeparator } from "macalicious/menu-item";
import { PushButton } from "macalicious/push-button";
import { Submenu, SubmenuPopup, SubmenuTrigger } from "macalicious/submenu";
import { TextField } from "macalicious/text-field";
import { TitleBar } from "macalicious/title-bar";
import { Window, WindowBody, type WindowProps } from "macalicious/window";
import { WindowControls } from "macalicious/window-controls";
import { useCallback, useEffect, useRef, useState } from "react";
import { whenMenusClosed } from "../notes/notes-menus";
import { fitsDesktopValue } from "./desktop-kept-value";
import { desktopValues, useDesktopSetting } from "./desktop-personal";
import { CHECK_GRAMMAR_KEY, nextGrammarIssue } from "./text-grammar";
import {
  flatOffset,
  flatText,
  loadWords,
  nextUnknownWord,
  normalWord,
  rangeOfFlat,
  spellingGuesses,
} from "./text-spelling";
import { replaceAllSubstitutions, type TextSubstitutions } from "./text-substitutions";
import "./text-tools.css";

/*
 * The editors' Edit > Spelling and Grammar and Edit > Substitutions, with their panels, for any text
 * view: a rich text element or a text area.
 */

const LEARNED_KEY = "text.learnedWords";

const readLearned = (stored: unknown): readonly string[] | undefined =>
  Array.isArray(stored) ? stored.filter((each) => typeof each === "string") : undefined;

const NO_LEARNED: readonly string[] = [];

/** The learned words with `word`, or `undefined` when one desktop value has no room: none is dropped. */
export function withLearnedWord(
  learned: readonly string[],
  word: string,
): readonly string[] | undefined {
  const plain = normalWord(word);
  if (learned.includes(plain)) return learned;
  const next = [...learned, plain];
  return fitsDesktopValue(next) ? next : undefined;
}

/** The words the person taught the desktop, kept with their account. */
export function useLearnedWords() {
  const [learned, setLearned] = useDesktopSetting(LEARNED_KEY, readLearned, NO_LEARNED);
  /** Whether the word is learned now. */
  const learn = useCallback(
    (word: string) => {
      const next = withLearnedWord(learned, word);
      if (next && next !== learned) setLearned(next);
      return next !== undefined;
    },
    [learned, setLearned],
  );
  return { learned, learn };
}

/** A view's text as the spelling commands read it and change it. */
interface TextSurface {
  text: string;
  /** Where the selection ends. */
  end: () => number;
  select: (start: number, end: number) => void;
  /** Puts `text` in place of the stretch, as one step on the Undo stack. Whether the browser did. */
  replace: (start: number, end: number, text: string) => boolean;
}

function surfaceOf(element: HTMLElement): TextSurface {
  if (element instanceof HTMLTextAreaElement) {
    return {
      text: element.value,
      end: () => element.selectionEnd,
      select: (start, end) => element.setSelectionRange(start, end),
      replace: (start, end, text) => {
        element.focus();
        element.setSelectionRange(start, end);
        return element.ownerDocument.execCommand("insertText", false, text);
      },
    };
  }
  const flat = flatText(element);
  const selection = element.ownerDocument.getSelection();
  const select = (start: number, end: number) => {
    const range = rangeOfFlat(flat, start, end);
    if (!range || !selection) return;
    selection.removeAllRanges();
    selection.addRange(range);
  };
  return {
    text: flat.text,
    end: () => {
      if (!selection?.rangeCount) return 0;
      const range = selection.getRangeAt(0);
      return element.contains(range.endContainer)
        ? flatOffset(flat, range.endContainer, range.endOffset)
        : 0;
    },
    select,
    replace: (start, end, text) => {
      element.focus();
      select(start, end);
      return element.ownerDocument.execCommand("insertText", false, text);
    },
  };
}

/** What the panel and Check Document Now find: a word the list does not hold, or a mistake of grammar. */
interface FoundText {
  word: string;
  start: number;
  end: number;
  /** A mistake of grammar: why, and what to change it to. */
  why?: string;
  change?: string;
}

/**
 * Change: puts `text` in place of the word found, if the word is still where it was found. The
 * document can change while the panel is open, and then the place holds something else; the browser
 * can refuse too. Whether the text there now is `text`.
 */
export function changeFoundWord(
  element: HTMLElement,
  found: { word: string; start: number; end: number },
  text: string,
): boolean {
  const surface = surfaceOf(element);
  if (surface.text.slice(found.start, found.end) !== found.word) return false;
  if (!surface.replace(found.start, found.end, text)) return false;
  return surfaceOf(element).text.slice(found.start, found.start + text.length) === text;
}

/**
 * Finds the next word `known` does not hold after the selection, or with Check Grammar on the next
 * mistake of grammar if that comes first, going round to the start once, and selects it.
 */
async function selectNextUnknown(
  element: HTMLElement,
  known: ReadonlySet<string>,
): Promise<FoundText | undefined> {
  const list = await loadWords();
  const surface = surfaceOf(element);
  const after = (from: number): FoundText | undefined => {
    const word = nextUnknownWord(surface.text, from, list, known);
    const grammar =
      desktopValues()[CHECK_GRAMMAR_KEY] === true
        ? nextGrammarIssue(surface.text, from, known)
        : undefined;
    return grammar && (!word || grammar.start < word.start) ? grammar : word;
  };
  const found = after(surface.end()) ?? after(0);
  if (found) surface.select(found.start, found.end);
  return found;
}

/** Check Document Now: selects the next word not in the list, leaving the keyboard in the text. */
export async function checkDocumentNow(
  element: HTMLElement,
  known: Iterable<string>,
): Promise<void> {
  element.focus();
  await selectNextUnknown(element, new Set(known));
}

/**
 * Check Document Now from a menu: once the menu has closed, so the keyboard stays in the text.
 * `whenMenusClosed` calls back twice, and a second check would go on to the next word.
 */
export function checkDocumentAfterMenu(
  element: () => HTMLElement | null,
  known: () => Iterable<string>,
): void {
  const first = element();
  if (!first) return;
  let checked = false;
  whenMenusClosed(first.ownerDocument, () => {
    const view = element();
    if (!view) return;
    if (checked) view.focus({ preventScroll: true });
    else void checkDocumentNow(view, known());
    checked = true;
  });
}

/** A panel of the editors: a small window floating over the page. */
function ToolPanel({
  title,
  onClose,
  children,
  ...props
}: Omit<WindowProps, "title"> & { title: string; onClose: () => void }) {
  return (
    <Window
      variant="panel"
      role="dialog"
      aria-label={title}
      width="var(--mac-desktop-text-tool-panel-width)"
      {...props}
    >
      <TitleBar
        title={title}
        controls={<WindowControls onClose={onClose} minimizeDisabled zoomDisabled />}
      />
      <WindowBody className="mac-desktop-text-tool-panel">{children}</WindowBody>
    </Window>
  );
}

/** Check Grammar With Spelling, kept with the person's account for every editor. */
export function useCheckGrammar() {
  return useDesktopSetting(CHECK_GRAMMAR_KEY, readCheckGrammar, false);
}

const readCheckGrammar = (stored: unknown): boolean | undefined =>
  typeof stored === "boolean" ? stored : undefined;

/** Show Spelling and Grammar: goes through the words of a view the list does not hold. */
export function SpellingPanel({
  element,
  editable,
  ignored,
  onClose,
  ...props
}: Omit<WindowProps, "title"> & {
  /** The view being checked. */
  element: () => HTMLElement | null;
  editable: boolean;
  /** The words Ignore has passed over, until the app closes. */
  ignored: Set<string>;
  onClose: () => void;
}) {
  const { learned, learn } = useLearnedWords();
  const [checkGrammar, setCheckGrammar] = useCheckGrammar();
  const [found, setFound] = useState<FoundText | null>(null);
  const [change, setChange] = useState("");
  const [guesses, setGuesses] = useState<readonly string[]>([]);
  const [finished, setFinished] = useState(false);
  const [learnFull, setLearnFull] = useState(false);
  const [notChanged, setNotChanged] = useState(false);
  const learnedNow = useRef(learned);
  learnedNow.current = learned;

  const findNext = useCallback(
    async (also?: string) => {
      const view = element();
      if (!view) return;
      const known = new Set([...learnedNow.current, ...ignored]);
      if (also) known.add(normalWord(also));
      setLearnFull(false);
      setNotChanged(false);
      const next = await selectNextUnknown(view, known);
      setFound(next ?? null);
      setFinished(!next);
      setChange(next?.change ?? next?.word ?? "");
      if (next?.change !== undefined) setGuesses([next.change]);
      else if (next) {
        const list = await loadWords();
        setGuesses(spellingGuesses(next.word, list));
      } else setGuesses([]);
    },
    [element, ignored],
  );

  const first = useRef(findNext);
  useEffect(() => {
    void first.current();
  }, []);

  const changeWord = async () => {
    const view = element();
    if (!view || !found || !editable) return;
    if (!changeFoundWord(view, found, change)) {
      setNotChanged(true);
      return;
    }
    await findNext();
  };

  const renderGuess = useCallback((index: number) => guesses[index] ?? "", [guesses]);
  const guessId = useCallback((index: number) => guesses[index] ?? index, [guesses]);

  return (
    <ToolPanel title="Spelling and Grammar" onClose={onClose} {...props}>
      <p role="status" className="mac-desktop-text-tool-status">
        {learnFull
          ? "The list of learned words is full: this word was not learned, and none was removed."
          : notChanged
            ? "The word was not changed: the text there is no longer the same. Choose Find Next."
            : finished
              ? checkGrammar
                ? "No more spelling or grammar errors were found."
                : "No more spelling errors were found."
              : found?.why
                ? found.why
                : found
                  ? `Not in the dictionary: “${found.word}”`
                  : "Checking…"}
      </p>
      <TextField
        aria-label="Change to"
        value={change}
        disabled={!found}
        onValueChange={setChange}
      />
      <ListView
        aria-label="Guesses"
        className="mac-desktop-text-tool-guesses"
        count={guesses.length}
        renderRow={renderGuess}
        getRowId={guessId}
        value={guesses.includes(change) ? [change] : []}
        onValueChange={(ids) => {
          const [id] = ids;
          if (typeof id === "string") setChange(id);
        }}
      />
      <div className="mac-desktop-text-tool-actions">
        <PushButton disabled={!found || !editable || !change} onClick={() => void changeWord()}>
          Change
        </PushButton>
        <DefaultButton onClick={() => void findNext()}>Find Next</DefaultButton>
        <PushButton
          disabled={!found}
          onClick={() => {
            if (!found) return;
            ignored.add(normalWord(found.word));
            void findNext(found.word);
          }}
        >
          Ignore
        </PushButton>
        <PushButton
          disabled={!found || found.why !== undefined}
          onClick={() => {
            if (!found) return;
            if (!learn(found.word)) {
              setLearnFull(true);
              return;
            }
            void findNext(found.word);
          }}
        >
          Learn
        </PushButton>
      </div>
      <Checkbox
        checked={checkGrammar}
        onCheckedChange={(checked) => setCheckGrammar(checked === true)}
      >
        Check Grammar
      </Checkbox>
    </ToolPanel>
  );
}

const SUBSTITUTIONS: readonly (readonly [keyof TextSubstitutions, string])[] = [
  ["copyPaste", "Smart Copy/Paste"],
  ["quotes", "Smart Quotes"],
  ["dashes", "Smart Dashes"],
  ["links", "Smart Links"],
  ["replacement", "Text Replacement"],
];

/** Why Data Detectors is dimmed in an application that does not look for what they find. */
export const NO_DATA_DETECTORS =
  "Here only TextEdit offers actions on the addresses, dates and phone numbers in typed text.";

/** An application's own Data Detectors setting, which takes the row from its reason. */
export interface DataDetectorsChoice {
  checked: boolean;
  onChange: (checked: boolean) => void;
}

/** Show Substitutions: the same checks as the menu, and Replace All on the text as it stands. */
export function SubstitutionsPanel({
  element,
  editable,
  settings,
  detectors,
  onChange,
  onClose,
  ...props
}: Omit<WindowProps, "title" | "onChange"> & {
  element: () => HTMLElement | null;
  editable: boolean;
  settings: TextSubstitutions;
  detectors?: DataDetectorsChoice;
  onChange: (settings: TextSubstitutions) => void;
  onClose: () => void;
}) {
  return (
    <ToolPanel title="Substitutions" onClose={onClose} {...props}>
      {SUBSTITUTIONS.map(([key, label]) => (
        <Checkbox
          key={key}
          checked={settings[key]}
          onCheckedChange={(checked) => onChange({ ...settings, [key]: checked === true })}
        >
          {label}
        </Checkbox>
      ))}
      {detectors ? (
        <Checkbox
          checked={detectors.checked}
          onCheckedChange={(checked) => detectors.onChange(checked === true)}
        >
          Data Detectors
        </Checkbox>
      ) : (
        <Checkbox disabled title={NO_DATA_DETECTORS}>
          Data Detectors
        </Checkbox>
      )}
      <div className="mac-desktop-text-tool-actions">
        <PushButton
          disabled={!editable}
          onClick={() => {
            const view = element();
            if (view) replaceAllSubstitutions(view, settings);
          }}
        >
          Replace All
        </PushButton>
      </div>
    </ToolPanel>
  );
}

/** Why automatic correction is dimmed. */
export const NO_AUTOCORRECT =
  "Without a reader of the sentence around a word, correcting it as it is typed changes names and words the list does not hold.";

/** Edit > Spelling and Grammar. */
export function SpellingItems({
  disabled,
  whileTyping,
  onToggleWhileTyping,
  onShow,
  onCheckNow,
}: {
  disabled: boolean;
  whileTyping: boolean;
  onToggleWhileTyping: () => void;
  onShow: () => void;
  onCheckNow: () => void;
}) {
  const [checkGrammar, setCheckGrammar] = useCheckGrammar();
  return (
    <Submenu disabled={disabled}>
      <SubmenuTrigger>Spelling and Grammar</SubmenuTrigger>
      <SubmenuPopup aria-label="Spelling and Grammar">
        <MenuItem keyEquivalent="shift+command+;" onClick={onShow}>
          Show Spelling and Grammar
        </MenuItem>
        <MenuItem keyEquivalent="command+;" onClick={onCheckNow}>
          Check Document Now
        </MenuItem>
        <MenuSeparator />
        <MenuCheckboxItem checked={whileTyping} onCheckedChange={onToggleWhileTyping}>
          Check Spelling While Typing
        </MenuCheckboxItem>
        <MenuCheckboxItem
          checked={checkGrammar}
          onCheckedChange={() => setCheckGrammar(!checkGrammar)}
        >
          Check Grammar With Spelling
        </MenuCheckboxItem>
        <MenuItem disabled title={NO_AUTOCORRECT}>
          Correct Spelling Automatically
        </MenuItem>
      </SubmenuPopup>
    </Submenu>
  );
}

/** Edit > Substitutions. */
export function SubstitutionItems({
  disabled,
  settings,
  detectors,
  onChange,
  onShow,
}: {
  disabled: boolean;
  settings: TextSubstitutions;
  detectors?: DataDetectorsChoice;
  onChange: (settings: TextSubstitutions) => void;
  onShow: () => void;
}) {
  return (
    <Submenu disabled={disabled}>
      <SubmenuTrigger>Substitutions</SubmenuTrigger>
      <SubmenuPopup aria-label="Substitutions">
        <MenuItem onClick={onShow}>Show Substitutions</MenuItem>
        <MenuSeparator />
        {SUBSTITUTIONS.map(([key, label]) => (
          <MenuCheckboxItem
            key={key}
            checked={settings[key]}
            onCheckedChange={(checked) => onChange({ ...settings, [key]: checked })}
          >
            {label}
          </MenuCheckboxItem>
        ))}
        {detectors ? (
          <MenuCheckboxItem checked={detectors.checked} onCheckedChange={detectors.onChange}>
            Data Detectors
          </MenuCheckboxItem>
        ) : (
          <MenuItem disabled title={NO_DATA_DETECTORS}>
            Data Detectors
          </MenuItem>
        )}
      </SubmenuPopup>
    </Submenu>
  );
}
