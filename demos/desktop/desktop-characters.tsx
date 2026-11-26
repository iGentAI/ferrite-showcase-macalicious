"use client";

import { SearchField } from "macalicious/search-field";
import { TitleBar } from "macalicious/title-bar";
import { Window, WindowBody } from "macalicious/window";
import { WindowControls } from "macalicious/window-controls";
import { useEffect, useId, useState, useSyncExternalStore } from "react";
import "./desktop-characters.css";

/**
 * Emoji & Symbols, the character viewer of every application's Edit menu: a panel of characters that
 * puts the one chosen where the person was typing, whichever window that is in.
 */

const GROUPS: readonly (readonly [string, readonly (readonly [string, string])[]])[] = [
  [
    "Smileys & People",
    [
      ["😀", "grinning face"],
      ["😂", "tears of joy"],
      ["🙂", "slight smile"],
      ["😉", "wink"],
      ["😍", "heart eyes"],
      ["😎", "sunglasses"],
      ["🤔", "thinking"],
      ["😴", "sleeping"],
      ["😢", "crying"],
      ["😡", "angry"],
      ["👍", "thumbs up"],
      ["👎", "thumbs down"],
      ["👋", "waving hand"],
      ["🙏", "folded hands"],
      ["👏", "clapping hands"],
      ["💪", "flexed arm"],
    ],
  ],
  [
    "Animals & Nature",
    [
      ["🐶", "dog"],
      ["🐱", "cat"],
      ["🐭", "mouse"],
      ["🐰", "rabbit"],
      ["🦊", "fox"],
      ["🐻", "bear"],
      ["🐧", "penguin"],
      ["🐢", "turtle"],
      ["🌸", "blossom"],
      ["🌲", "evergreen tree"],
      ["🌞", "sun"],
      ["🌧", "rain cloud"],
    ],
  ],
  [
    "Food & Drink",
    [
      ["🍎", "apple"],
      ["🍌", "banana"],
      ["🍕", "pizza"],
      ["🍔", "hamburger"],
      ["🍣", "sushi"],
      ["🍰", "cake"],
      ["☕", "coffee"],
      ["🍺", "beer"],
    ],
  ],
  [
    "Travel & Places",
    [
      ["🚗", "car"],
      ["🚲", "bicycle"],
      ["✈️", "airplane"],
      ["🚀", "rocket"],
      ["⛵", "sailboat"],
      ["🏠", "house"],
      ["🏔", "mountain"],
      ["🌍", "globe"],
    ],
  ],
  [
    "Objects",
    [
      ["💻", "laptop"],
      ["📱", "mobile phone"],
      ["📷", "camera"],
      ["📚", "books"],
      ["✏️", "pencil"],
      ["📎", "paperclip"],
      ["🔑", "key"],
      ["💡", "light bulb"],
      ["🎵", "musical note"],
      ["🎁", "gift"],
    ],
  ],
  [
    "Symbols",
    [
      ["❤️", "red heart"],
      ["⭐", "star"],
      ["✅", "check mark"],
      ["❌", "cross mark"],
      ["⚠️", "warning"],
      ["→", "right arrow"],
      ["←", "left arrow"],
      ["↑", "up arrow"],
      ["↓", "down arrow"],
      ["⌘", "command"],
      ["⌥", "option"],
      ["⇧", "shift"],
      ["©", "copyright"],
      ["€", "euro"],
      ["£", "pound"],
      ["°", "degree"],
      ["±", "plus or minus"],
      ["…", "ellipsis"],
    ],
  ],
];

let shown = false;
const listeners = new Set<() => void>();

/** Shows the character viewer, or hides it: Edit > Emoji & Symbols, Control-Command-Space. */
export function toggleCharacterViewer(): void {
  shown = !shown;
  for (const listener of listeners) listener();
}

const subscribe = (listener: () => void) => {
  listeners.add(listener);
  return () => listeners.delete(listener);
};

const readShown = () => shown;

const PANEL = ".mac-desktop-characters";

/** Where the person was typing: the field, and in rich text the place in it. */
let field: HTMLElement | null = null;
let caret: Range | null = null;

const editable = (target: EventTarget | null): target is HTMLElement =>
  target instanceof HTMLElement &&
  !target.closest(PANEL) &&
  (target.isContentEditable || target instanceof HTMLTextAreaElement || isTextInput(target));

const isTextInput = (target: HTMLElement) =>
  target instanceof HTMLInputElement &&
  !["button", "checkbox", "color", "file", "radio", "range", "submit"].includes(target.type);

function noteFocus(event: FocusEvent) {
  if (editable(event.target)) field = event.target;
}

function noteCaret() {
  if (!field?.isContentEditable || document.activeElement !== field) return;
  const selection = document.getSelection();
  if (selection?.rangeCount) caret = selection.getRangeAt(0).cloneRange();
}

/** Puts `text` where the person was typing, as typing would. Whether there was such a place. */
function insert(text: string): boolean {
  if (!field?.isConnected || field.closest("[inert]")) return false;
  field.focus({ preventScroll: true });
  if (field.isContentEditable && caret) {
    const selection = document.getSelection();
    selection?.removeAllRanges();
    selection?.addRange(caret);
  }
  return document.execCommand("insertText", false, text);
}

/** The character viewer, while it shows. The desktop holds one, so it knows where typing was. */
export function DesktopCharacterViewer() {
  const open = useSyncExternalStore(subscribe, readShown, () => false);
  const [query, setQuery] = useState("");
  const [lost, setLost] = useState(false);
  const id = useId();
  useEffect(() => {
    document.addEventListener("focusin", noteFocus);
    document.addEventListener("selectionchange", noteCaret);
    return () => {
      document.removeEventListener("focusin", noteFocus);
      document.removeEventListener("selectionchange", noteCaret);
    };
  }, []);
  if (!open) return null;
  const wanted = query.trim().toLowerCase();
  return (
    <Window className="mac-desktop-characters" aria-label="Characters" role="dialog">
      <TitleBar
        title="Characters"
        controls={<WindowControls onClose={toggleCharacterViewer} minimizeDisabled zoomDisabled />}
      />
      <WindowBody className="mac-desktop-characters-body">
        <SearchField
          aria-label="Search characters"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
        />
        {lost ? (
          <p role="status" className="mac-desktop-characters-note">
            Click in a text field first.
          </p>
        ) : null}
        <div className="mac-desktop-characters-list">
          {GROUPS.map(([group, characters]) => {
            const found = characters.filter(([, name]) => name.includes(wanted));
            if (found.length === 0) return null;
            return (
              <section key={group} aria-labelledby={`${id}-${group}`}>
                <h4 id={`${id}-${group}`} className="mac-desktop-characters-group">
                  {group}
                </h4>
                <div className="mac-desktop-characters-grid">
                  {found.map(([character, name]) => (
                    <button
                      key={name}
                      type="button"
                      aria-label={name}
                      title={name}
                      className="mac-desktop-characters-cell"
                      // The focus stays in the field being typed in.
                      onMouseDown={(event) => event.preventDefault()}
                      onClick={() => setLost(!insert(character))}
                    >
                      {character}
                    </button>
                  ))}
                </div>
              </section>
            );
          })}
        </div>
      </WindowBody>
    </Window>
  );
}
