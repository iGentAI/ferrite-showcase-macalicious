"use client";

import {
  type FormEvent,
  type ReactNode,
  type RefObject,
  useCallback,
  useRef,
  useState,
} from "react";
import { readBoolean, useDesktopSetting } from "../desktop/desktop-personal";
import {
  pasteEdges,
  spaceAfterPaste,
  substituteTyped,
  useTextSubstitutions,
} from "../desktop/text-substitutions";
import {
  checkDocumentAfterMenu,
  SpellingItems,
  SpellingPanel,
  SubstitutionItems,
  SubstitutionsPanel,
  useLearnedWords,
} from "../desktop/text-tools";
import { type EditMenuTarget, SpeechItems } from "../notes/notes-edit-menu";

const MESSAGES_SPELLING = "messages.spelling";

export interface MessageFieldTools {
  /** Spelling and Grammar, Substitutions and Speech: for the Edit menu and the field's own menu. */
  rows: ReactNode;
  /** The Spelling and Substitutions panels that are open. */
  panels: ReactNode;
  /** The rows' keys. */
  keys: readonly { equivalent: string; run: () => void }[];
  /** What the message field needs for the settings to act as it is typed in. */
  fieldProps: {
    spellCheck: boolean;
    "data-text-replacement": "on" | "off";
    onPaste: (event: React.ClipboardEvent<HTMLTextAreaElement>) => void;
    onInput: (event: FormEvent<HTMLTextAreaElement>) => void;
  };
}

/** The text tools of the desktop's editors, on the message field; their settings go with the person. */
export function useMessageFieldTools(
  field: RefObject<HTMLTextAreaElement | null>,
): MessageFieldTools {
  const [spelling, setSpelling] = useDesktopSetting(MESSAGES_SPELLING, readBoolean, true);
  const [substitutions, setSubstitutions] = useTextSubstitutions("messages");
  const [spellingShown, setSpellingShown] = useState(false);
  const [substitutionsShown, setSubstitutionsShown] = useState(false);
  const [ignored] = useState(() => new Set<string>());
  const { learned } = useLearnedWords();
  const learnedNow = useRef(learned);
  learnedNow.current = learned;
  const pasteStart = useRef<ReturnType<typeof pasteEdges>>(undefined);
  const pasted = useRef("");

  const element = useCallback(() => field.current, [field]);
  const target = useCallback((): EditMenuTarget | null => {
    const input = field.current;
    return input
      ? { element: input, restore: () => input.focus(), editable: !input.disabled, rich: false }
      : null;
  }, [field]);
  const checkNow = useCallback(
    () => checkDocumentAfterMenu(element, () => [...learnedNow.current, ...ignored]),
    [element, ignored],
  );
  const disabled = field.current?.disabled ?? true;

  return {
    rows: (
      <>
        <SpellingItems
          disabled={disabled}
          whileTyping={spelling}
          onToggleWhileTyping={() => setSpelling(!spelling)}
          onShow={() => setSpellingShown(true)}
          onCheckNow={checkNow}
        />
        <SubstitutionItems
          disabled={disabled}
          settings={substitutions}
          onChange={setSubstitutions}
          onShow={() => setSubstitutionsShown(true)}
        />
        <SpeechItems target={target} />
      </>
    ),
    panels:
      spellingShown || substitutionsShown ? (
        <div className="mac-messages-tool-panels">
          {spellingShown ? (
            <SpellingPanel
              element={element}
              editable={!disabled}
              ignored={ignored}
              onClose={() => setSpellingShown(false)}
            />
          ) : null}
          {substitutionsShown ? (
            <SubstitutionsPanel
              element={element}
              editable={!disabled}
              settings={substitutions}
              onChange={setSubstitutions}
              onClose={() => setSubstitutionsShown(false)}
            />
          ) : null}
        </div>
      ) : null,
    keys: [
      { equivalent: "shift+command+;", run: () => setSpellingShown(true) },
      { equivalent: "command+;", run: checkNow },
    ],
    fieldProps: {
      spellCheck: spelling,
      "data-text-replacement": substitutions.replacement ? "on" : "off",
      onPaste: (event) => {
        pasteStart.current = pasteEdges(event.currentTarget);
        pasted.current = event.clipboardData.getData("text/plain");
      },
      onInput: (event) => {
        const native = event.nativeEvent as InputEvent;
        if (native.inputType === "insertText" && !native.isComposing) {
          substituteTyped(event.currentTarget, native.data, substitutions, false);
        }
        if (native.inputType === "insertFromPaste" && substitutions.copyPaste) {
          spaceAfterPaste(event.currentTarget, pasted.current, pasteStart.current);
        }
      },
    },
  };
}
