"use client";

import { MenuItem } from "macalicious/menu-item";
import { Submenu, SubmenuPopup, SubmenuTrigger } from "macalicious/submenu";

/** How long a menu holds the keyboard after a choice (`menu.css`: it fades for 0.25 s). */
const MENU_FADE_MS = 300;

const NOTHING_SELECTED = "Select text in a field of a card being edited.";
const NO_VOICE = "This browser has no voice to speak with.";

/** A field's selected text; empty when it has none or will not say, as an email input will not. */
function selectionOf(field: HTMLInputElement | HTMLTextAreaElement | null): string {
  if (!field?.isConnected || field.selectionStart === null || field.selectionEnd === null) {
    return "";
  }
  return field.value.slice(field.selectionStart, field.selectionEnd);
}

const capitalized = (text: string) =>
  text
    .toLowerCase()
    .replace(/(^|[\s\p{P}])(\p{L})/gu, (_, before, letter) => before + letter.toUpperCase());

/**
 * Edit > Transformations and Speech. Transformations act on the text selected in the field that last
 * had the keyboard, and Start Speaking speaks that text, the text selected on the card, or else
 * `wholeCard`. The popup of a menu mounts each time it opens, so what is dimmed is read as it opens.
 */
export function ContactsTextRows({
  field,
  wholeCard,
}: {
  field: () => HTMLInputElement | HTMLTextAreaElement | null;
  /** The card shown, as text to speak; empty when none is. */
  wholeCard: () => string;
}) {
  const at = field();
  const selected = selectionOf(at);
  const canChange = selected !== "" && !at?.readOnly;
  const transform = (change: (text: string) => string) => {
    if (!at || at.selectionStart === null || at.selectionEnd === null) return;
    const range: [number, number] = [at.selectionStart, at.selectionEnd];
    setTimeout(() => {
      if (!at.isConnected || !document.hasFocus()) return;
      at.focus();
      if (document.activeElement !== at) return;
      at.setSelectionRange(...range);
      document.execCommand("insertText", false, change(selected));
    }, MENU_FADE_MS);
  };
  const transformRow = (title: string, change: (text: string) => string) => (
    <MenuItem
      disabled={!canChange}
      title={canChange ? undefined : NOTHING_SELECTED}
      onClick={() => transform(change)}
    >
      {title}
    </MenuItem>
  );
  const voice = typeof speechSynthesis !== "undefined";
  const spoken = selected || (window.getSelection()?.toString() ?? "") || wholeCard();
  return (
    <>
      <Submenu>
        <SubmenuTrigger>Transformations</SubmenuTrigger>
        <SubmenuPopup>
          {transformRow("Make Upper Case", (text) => text.toUpperCase())}
          {transformRow("Make Lower Case", (text) => text.toLowerCase())}
          {transformRow("Capitalize", capitalized)}
        </SubmenuPopup>
      </Submenu>
      <Submenu>
        <SubmenuTrigger>Speech</SubmenuTrigger>
        <SubmenuPopup>
          <MenuItem
            disabled={!voice || spoken === ""}
            title={voice ? undefined : NO_VOICE}
            onClick={() => {
              speechSynthesis.cancel();
              speechSynthesis.speak(new SpeechSynthesisUtterance(spoken));
            }}
          >
            Start Speaking
          </MenuItem>
          <MenuItem
            disabled={!voice}
            title={voice ? undefined : NO_VOICE}
            onClick={() => speechSynthesis.cancel()}
          >
            Stop Speaking
          </MenuItem>
        </SubmenuPopup>
      </Submenu>
    </>
  );
}
