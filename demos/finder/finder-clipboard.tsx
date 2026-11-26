"use client";

import { TitleBar } from "macalicious/title-bar";
import { Window, WindowBody } from "macalicious/window";
import { WindowControls } from "macalicious/window-controls";
import type { ComponentProps } from "react";
import { useEffect, useState } from "react";
import { useCopiedDriveItems } from "../desktop/desktop-clipboard";

/** What the browser's clipboard holds as text; `null` when the browser doesn't let a page read it. */
function useClipboardText(): string | null | undefined {
  const [text, setText] = useState<string | null | undefined>(undefined);
  useEffect(() => {
    let live = true;
    const read = () => {
      navigator.clipboard?.readText().then(
        (found) => {
          if (live) setText(found);
        },
        () => {
          if (live) setText(null);
        },
      );
    };
    read();
    // Copying here tells the page, unless a program writes to the clipboard directly (`copyText`) or another
    // program does while this page has the focus: those are seen within a moment.
    const again = () => setTimeout(read, 0);
    document.addEventListener("copy", again);
    document.addEventListener("cut", again);
    window.addEventListener("focus", read);
    const reading = setInterval(read, 1500);
    return () => {
      live = false;
      document.removeEventListener("copy", again);
      document.removeEventListener("cut", again);
      window.removeEventListener("focus", read);
      clearInterval(reading);
    };
  }, []);
  return text;
}

export interface FinderClipboardProps extends ComponentProps<typeof Window> {
  onClose: () => void;
}

/** Edit > Show Clipboard: what is copied, as files on this desktop or as text. */
export function FinderClipboard({ onClose, ...props }: FinderClipboardProps) {
  const items = useCopiedDriveItems();
  const text = useClipboardText();
  const what =
    [
      items.length === 1 ? "item" : items.length > 1 ? "items" : "",
      text ? "text" : text === null && items.length === 0 ? "unknown" : "",
    ]
      .filter(Boolean)
      .join(" and ") || "nothing";
  return (
    <Window {...props}>
      <TitleBar
        title="Clipboard"
        controls={<WindowControls onClose={onClose} minimizeDisabled zoomDisabled />}
      />
      <WindowBody className="mac-finder-clipboard">
        <p className="mac-finder-detail">Clipboard contents: {what}</p>
        {items.length > 0 ? (
          <ul className="mac-finder-clipboard-items">
            {items.map((item) => (
              <li key={item.id}>{item.name}</li>
            ))}
          </ul>
        ) : null}
        {text ? <pre className="mac-finder-clipboard-text">{text}</pre> : null}
        {text === null && items.length === 0 ? (
          <p className="mac-finder-detail">
            This browser doesn’t let the page read what was copied outside it.
          </p>
        ) : null}
      </WindowBody>
    </Window>
  );
}
