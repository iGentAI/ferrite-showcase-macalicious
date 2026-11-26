"use client";

import {
  ContextualMenu,
  ContextualMenuPopup,
  ContextualMenuTrigger,
} from "macalicious/contextual-menu";
import { MenuItem, MenuSeparator } from "macalicious/menu-item";
import { type ReactNode, type RefObject, useState } from "react";
import { openUrl } from "../desktop/desktop-open-url";
import { lookUp } from "../dictionary/dictionary-desktop";
import { addressOfLink, writeTo } from "./mail-links";

/** The longest selection the Look Up row names; the whole of it is what is looked up. */
const NAMED = 24;

/** What was under the pointer when the menu opened. */
interface Pointed {
  text: string;
  link: string | null;
}

/**
 * The contextual menu of a message's text, in place of the browser's: Look Up, Copy, Select All, the
 * link under the pointer, and Speech on the selection or the whole message.
 */
export function MailTextMenu({
  paneRef,
  className,
  children,
}: {
  /** The element that holds the text, which the menu's area is. */
  paneRef: RefObject<HTMLDivElement | null>;
  className?: string;
  children: ReactNode;
}) {
  const [pointed, setPointed] = useState<Pointed>({ text: "", link: null });
  const { text, link } = pointed;
  const speech = typeof speechSynthesis !== "undefined";
  const copy = (what: string) => void navigator.clipboard?.writeText(what);
  const address = link ? addressOfLink(link) : null;
  const named = text.length > NAMED ? `${text.slice(0, NAMED)}…` : text;
  return (
    <ContextualMenu>
      <ContextualMenuTrigger
        render={<div ref={paneRef} className={className} />}
        onContextMenu={(event) => {
          const selection = event.currentTarget.ownerDocument.getSelection();
          const inside =
            selection?.anchorNode && event.currentTarget.contains(selection.anchorNode);
          setPointed({
            text: inside ? (selection?.toString().trim() ?? "") : "",
            link: (event.target as Element).closest("a")?.getAttribute("href") ?? null,
          });
        }}
      >
        {children}
      </ContextualMenuTrigger>
      <ContextualMenuPopup>
        <MenuItem
          disabled={text === ""}
          title={text === "" ? "Select a word to look it up." : undefined}
          onClick={() => lookUp(text)}
        >
          {text === "" ? "Look Up" : `Look Up “${named}”`}
        </MenuItem>
        <MenuSeparator />
        <MenuItem
          disabled={text === ""}
          title={text === "" ? "Select some text to copy it." : undefined}
          onClick={() => copy(text)}
        >
          Copy
        </MenuItem>
        <MenuItem
          onClick={() => {
            const pane = paneRef.current;
            const selection = pane?.ownerDocument.getSelection();
            if (!pane || !selection) return;
            selection.selectAllChildren(pane);
          }}
        >
          Select All
        </MenuItem>
        {link && address ? (
          <>
            <MenuSeparator />
            <MenuItem onClick={() => writeTo(address)}>New Message</MenuItem>
            <MenuItem onClick={() => copy(address)}>Copy Address</MenuItem>
          </>
        ) : null}
        {link && !address ? (
          <>
            <MenuSeparator />
            <MenuItem onClick={() => openUrl(link, "mail")}>Open Link</MenuItem>
            <MenuItem onClick={() => copy(link)}>Copy Link</MenuItem>
          </>
        ) : null}
        <MenuSeparator />
        <MenuItem
          disabled={!speech}
          title={speech ? undefined : "This browser has no voice to speak with."}
          onClick={() => {
            speechSynthesis.cancel();
            speechSynthesis.speak(
              new SpeechSynthesisUtterance(text || (paneRef.current?.textContent ?? "")),
            );
          }}
        >
          Start Speaking
        </MenuItem>
        <MenuItem
          disabled={!speech}
          title={speech ? undefined : "This browser has no voice to speak with."}
          onClick={() => speechSynthesis.cancel()}
        >
          Stop Speaking
        </MenuItem>
      </ContextualMenuPopup>
    </ContextualMenu>
  );
}
