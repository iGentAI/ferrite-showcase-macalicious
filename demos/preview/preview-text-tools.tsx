"use client";

import { MenuSeparator } from "macalicious/menu-item";
import { type FormEvent, useCallback, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { readBoolean, useDesktopSetting } from "../desktop/desktop-personal";
import { substituteTyped, useTextSubstitutions } from "../desktop/text-substitutions";
import {
  SpellingItems,
  SpellingPanel,
  SubstitutionItems,
  SubstitutionsPanel,
} from "../desktop/text-tools";
import type { Mark } from "./preview-markup";
import { PREVIEW_SETTINGS } from "./preview-settings";

/** What a text or a note being written takes from Edit's Spelling and Substitutions. */
export function usePreviewFieldTyping() {
  const [spellCheck] = useDesktopSetting(PREVIEW_SETTINGS.spellingWhileTyping, readBoolean, true);
  const [settings] = useTextSubstitutions("preview");
  const onInput = useCallback(
    (event: FormEvent<HTMLTextAreaElement>) => {
      substituteTyped(
        event.currentTarget,
        (event.nativeEvent as InputEvent).data ?? null,
        settings,
        false,
      );
    },
    [settings],
  );
  return { spellCheck, onInput };
}

/**
 * Edit > Spelling and Grammar and Substitutions, on the text or note chosen. A press on the menu bar
 * ends the writing of a text, so these act on the mark itself: a text area out of sight holds what it
 * says, and what the panels change in it goes to the mark.
 */
export function usePreviewTextTools({
  mark,
  onChange,
}: {
  /** The text or note chosen. */
  mark: Mark | undefined;
  onChange: (text: string) => void;
}) {
  const [whileTyping, setWhileTyping] = useDesktopSetting(
    PREVIEW_SETTINGS.spellingWhileTyping,
    readBoolean,
    true,
  );
  const [settings, setSettings] = useTextSubstitutions("preview");
  const [spelling, setSpelling] = useState(false);
  const [substitutions, setSubstitutions] = useState(false);
  const ignored = useRef(new Set<string>());
  const text = useRef<HTMLTextAreaElement>(null);
  const element = useCallback(() => text.current, []);
  const items = (
    <>
      <MenuSeparator />
      <SpellingItems
        disabled={!mark}
        whileTyping={whileTyping}
        onToggleWhileTyping={() => setWhileTyping(!whileTyping)}
        onShow={() => setSpelling(true)}
        onCheckNow={() => setSpelling(true)}
      />
      <SubstitutionItems
        disabled={!mark}
        settings={settings}
        onChange={setSettings}
        onShow={() => setSubstitutions(true)}
      />
    </>
  );
  const panels =
    (spelling || substitutions) && typeof document !== "undefined"
      ? createPortal(
          <div className="mac-preview-app-tool-panels">
            {mark ? (
              <textarea
                ref={text}
                className="mac-preview-app-tool-text"
                aria-hidden="true"
                tabIndex={-1}
                value={mark.text ?? ""}
                onChange={(event) => onChange(event.currentTarget.value)}
              />
            ) : null}
            {spelling ? (
              <SpellingPanel
                key={mark?.id}
                element={element}
                editable={mark !== undefined}
                ignored={ignored.current}
                onClose={() => setSpelling(false)}
              />
            ) : null}
            {substitutions ? (
              <SubstitutionsPanel
                element={element}
                editable={mark !== undefined}
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
