"use client";

import {
  ContextualMenu,
  ContextualMenuPopup,
  ContextualMenuTrigger,
} from "macalicious/contextual-menu";
import { MenuItem } from "macalicious/menu-item";
import type { ReactNode } from "react";
import { askToReach } from "../desktop/desktop-reach";
import { linkedText } from "../messages/linked-text";
import { detectedPieces } from "../messages/messages-detectors";
import { addressKey } from "./mail-data";

/** An address in text: `name@host`, this desktop's own among them, which have no dot. */
const ADDRESS = /[\w.+-]+@[A-Za-z0-9-]+(?:\.[A-Za-z0-9-]+)*/g;

const MAILTO = "mailto:";

/** The address of a `mailto:` link, or `null` for any other link. */
export const addressOfLink = (href: string): string | null =>
  href.toLowerCase().startsWith(MAILTO)
    ? decodeURIComponent(href.slice(MAILTO.length).split("?")[0] ?? "")
    : null;

/** A New Message to `address`, in this Mail. */
export const writeTo = (address: string, name = address) =>
  askToReach({ app: "mail", to: address, name });

/** What a press on a date found in a message's text asks: a Quick Event in Calendar holding it. */
export const addDateToCalendar = (date: string) =>
  askToReach({ app: "calendar", to: date, name: date });

/** What a date found in a message's text says when the pointer rests on it. */
export const DATE_TITLE = "Add to Calendar";

/** The first web address in `text`, what Reminders and the Reading List take of a message. */
export const firstWebAddress = (text: string): string | null =>
  /\bhttps?:\/\/[^\s<>"'`]+/i.exec(text)?.[0] ?? null;

/** The account of an address of this desktop: only such a person can be a card in Contacts. */
const accountOfAddress = (address: string) => /^([^@\s]+)@macalicious$/.exec(address)?.[1];

type Piece = { text: string; kind: "address" | "date" | null };

/** Plain words with the dates in them found, as Messages finds them. */
const datedPieces = (text: string): Piece[] => {
  const runs: Piece[] = [];
  for (const { text: run, kind } of detectedPieces(text)) {
    const last = runs.at(-1);
    if (kind === "date") runs.push({ text: run, kind: "date" });
    else if (last && last.kind === null) last.text += run;
    else runs.push({ text: run, kind: null });
  }
  return runs;
};

const pieces = (text: string): Piece[] => {
  const found: Piece[] = [];
  let at = 0;
  for (const match of text.matchAll(ADDRESS)) {
    const start = match.index;
    if (start > at) found.push(...datedPieces(text.slice(at, start)));
    found.push({ text: match[0], kind: "address" });
    at = start + match[0].length;
  }
  if (at < text.length) found.push(...datedPieces(text.slice(at)));
  return found;
};

/** One person in a message's Details: their name, with what can be done with their address. */
export function MailAddressToken({ name, written }: { name: string; written: string }) {
  const address = addressKey(written);
  const account = accountOfAddress(address);
  return (
    <ContextualMenu>
      <ContextualMenuTrigger render={<span className="mac-mail-address-token" title={address} />}>
        {name}
      </ContextualMenuTrigger>
      <ContextualMenuPopup aria-label={`Commands for ${name}`}>
        <MenuItem onClick={() => writeTo(written, name)}>New Email</MenuItem>
        <MenuItem onClick={() => void navigator.clipboard?.writeText(address)}>
          Copy Address
        </MenuItem>
        {account ? (
          <MenuItem onClick={() => askToReach({ app: "contacts", to: account, name })}>
            Add to Contacts
          </MenuItem>
        ) : null}
      </ContextualMenuPopup>
    </ContextualMenu>
  );
}

/** `text` with its web addresses opening in Safari, mail addresses in a New Message, dates in Calendar. */
export function mailLinkedText(text: string): ReactNode {
  // A web address may hold an @: what `linkedText` makes a link is left whole.
  const web = linkedText(text, "mail");
  const runs = Array.isArray(web) ? (web as ReactNode[]) : [web];
  return runs.flatMap((piece, index): ReactNode[] => {
    if (typeof piece !== "string") return [piece];
    return pieces(piece).map(({ text: run, kind }, at) =>
      kind === "address" ? (
        <a
          // biome-ignore lint/suspicious/noArrayIndexKey: the runs of one text never reorder
          key={`${index}-${at}`}
          href={`${MAILTO}${run}`}
          onClick={(event) => {
            event.preventDefault();
            writeTo(run);
          }}
        >
          {run}
        </a>
      ) : kind === "date" ? (
        <button
          // biome-ignore lint/suspicious/noArrayIndexKey: the runs of one text never reorder
          key={`${index}-${at}`}
          type="button"
          className="mac-mail-date"
          title={DATE_TITLE}
          onClick={() => addDateToCalendar(run)}
        >
          {run}
        </button>
      ) : (
        run
      ),
    );
  });
}

/**
 * The same over text already in the page (a message's styled text, after `linkTextNodes` has made
 * its web links): each address in a text node outside a link becomes one, built with the DOM's calls.
 */
export function linkAddressNodes(root: Element): void {
  const document = root.ownerDocument;
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  const texts: Text[] = [];
  for (let node = walker.nextNode(); node; node = walker.nextNode()) {
    if (!node.parentElement?.closest("a")) texts.push(node as Text);
  }
  for (const node of texts) {
    const runs = pieces(node.data);
    if (!runs.some(({ kind }) => kind !== null)) continue;
    const fragment = document.createDocumentFragment();
    for (const { text, kind } of runs) {
      if (kind === null) {
        fragment.append(document.createTextNode(text));
        continue;
      }
      if (kind === "date") {
        const button = document.createElement("button");
        button.type = "button";
        button.className = "mac-mail-date";
        button.title = DATE_TITLE;
        button.textContent = text;
        button.addEventListener("click", () => addDateToCalendar(text));
        fragment.append(button);
        continue;
      }
      const anchor = document.createElement("a");
      anchor.setAttribute("href", `${MAILTO}${text}`);
      anchor.textContent = text;
      anchor.addEventListener("click", (event) => {
        event.preventDefault();
        writeTo(text);
      });
      fragment.append(anchor);
    }
    node.replaceWith(fragment);
  }
}
