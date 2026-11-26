"use client";

import { Menu, MenuPopup, MenuTrigger } from "macalicious/menu";
import { MenuItem } from "macalicious/menu-item";
import { Fragment, type ReactNode } from "react";
import { openUrl } from "../desktop/desktop-open-url";
import { askToReach } from "../desktop/desktop-reach";
import { copyText } from "../desktop/desktop-share-link";
import { askMapsSearch } from "../maps/maps-open";
import { linkedText, linkPieces } from "./linked-text";

/** What a run of a message's text was found to be. */
export type DetectedKind = "email" | "phone" | "date" | "address" | "flight" | "tracking";

export interface DetectedPiece {
  text: string;
  kind: DetectedKind | null;
}

const MONTH =
  "jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|june?|july?|aug(?:ust)?|sep(?:t(?:ember)?)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?";
const DAY = "today|tomorrow|(?:next\\s+)?(?:mon|tues|wednes|thurs|fri|satur|sun)day";
const TIME = "\\d{1,2}(?::\\d{2})?\\s*[ap]m";
const EMAIL = "[a-z0-9._%+-]+@[a-z0-9-]+(?:\\.[a-z0-9-]+)+";
const PHONE = "(?:\\+?\\d[\\s.-]?)?(?:\\(\\d{3}\\)\\s?|\\d{3}[\\s.-])\\d{3}[\\s.-]\\d{4}";
const DATE = `(?:${DAY})(?:\\s+at\\s+\\d{1,2}(?::\\d{2})?(?:\\s*[ap]m)?)?|(?:${MONTH})\\.?\\s+\\d{1,2}(?:st|nd|rd|th)?(?:,?\\s+\\d{4})?(?:\\s+at\\s+${TIME})?|(?:at\\s+)?${TIME}`;
const STREET_NAME =
  "(?:street|st|avenue|ave|road|rd|boulevard|blvd|lane|ln|drive|dr|way|court|ct|place|pl)";
const ADDRESS = `\\d{1,5}\\s+(?:[a-z][a-z'.-]*\\s+){1,4}${STREET_NAME}\\b\\.?`;
const FLIGHT = "flight\\s+[a-z]{2}\\s?\\d{1,4}";
// UPS's 1Z numbers and USPS's 22 digits: other carriers' numbers are plain runs of digits.
const TRACKING = "1z[0-9a-z]{16}|9[1-5]\\d{20}";
const FOUND = new RegExp(
  `(?<![\\w@.-])(?:(?<email>${EMAIL})|(?<tracking>${TRACKING})|(?<flight>${FLIGHT})|(?<address>${ADDRESS})|(?<phone>${PHONE})|(?<date>${DATE}))(?![\\w@-])`,
  "gi",
);

/** A street's name is written with capitals: "3 people in the way" is not an address. */
const NAMED_STREET = /^\d+\s+(?:[A-Z][^\s]*\s+){1,4}[A-Za-z]+\.?$/;

/** `text` cut into plain runs and what the detectors found in it; joined, the runs are `text`. */
export function detectedPieces(text: string): DetectedPiece[] {
  const pieces: DetectedPiece[] = [];
  let at = 0;
  for (const match of text.matchAll(FOUND)) {
    const start = match.index ?? 0;
    const groups = match.groups ?? {};
    if (groups.address && !NAMED_STREET.test(match[0])) continue;
    if (start > at) pieces.push({ text: text.slice(at, start), kind: null });
    pieces.push({
      text: match[0],
      kind: groups.email
        ? "email"
        : groups.tracking
          ? "tracking"
          : groups.flight
            ? "flight"
            : groups.address
              ? "address"
              : groups.phone
                ? "phone"
                : "date",
    });
    at = start + match[0].length;
  }
  if (at < text.length) pieces.push({ text: text.slice(at), kind: null });
  return pieces;
}

export const COPY_LABEL: Record<DetectedKind, string> = {
  email: "Copy Email Address",
  phone: "Copy Phone Number",
  date: "Copy Date",
  address: "Copy Address",
  flight: "Copy Flight Number",
  tracking: "Copy Tracking Number",
};

/** Why a phone number's call is dimmed. */
export const NO_PHONE_CALL =
  "FaceTime here calls the accounts of this desktop, and cannot ring a phone number.";

/** Where a flight is followed. */
export const flightPage = (text: string) =>
  `https://www.flightaware.com/live/flight/${text
    .replace(/^flight\s+/i, "")
    .replace(/\s/g, "")
    .toUpperCase()}`;

/** Where a parcel is followed: its carrier's page. */
export const trackingPage = (text: string) =>
  /^1z/i.test(text)
    ? `https://www.ups.com/track?tracknum=${text.toUpperCase()}`
    : `https://tools.usps.com/go/TrackConfirmAction?tLabels=${text}`;

/** The rows of what a person can do with a found run, in any app's menu; each app words Copy its own way. */
export function DetectedRows({
  text,
  kind,
  from,
  copyLabel,
}: {
  text: string;
  kind: DetectedKind;
  /** The app whose menu it is, which a web page it opens goes back to. */
  from: string;
  copyLabel: string;
}) {
  return (
    <>
      {kind === "email" ? (
        <MenuItem onClick={() => askToReach({ app: "mail", to: text, name: text })}>
          New Mail Message
        </MenuItem>
      ) : null}
      {kind === "date" ? (
        <MenuItem onClick={() => askToReach({ app: "calendar", to: text, name: text })}>
          Create Event
        </MenuItem>
      ) : null}
      {kind === "address" ? (
        <MenuItem onClick={() => askMapsSearch(text)}>Show in Maps</MenuItem>
      ) : null}
      {kind === "flight" ? (
        <MenuItem onClick={() => openUrl(flightPage(text), from)}>Track Flight</MenuItem>
      ) : null}
      {kind === "tracking" ? (
        <MenuItem onClick={() => openUrl(trackingPage(text), from)}>Track Shipment</MenuItem>
      ) : null}
      {kind === "phone" ? (
        <MenuItem disabled title={NO_PHONE_CALL}>
          Call with FaceTime
        </MenuItem>
      ) : null}
      <MenuItem onClick={() => void copyText(text)}>{copyLabel}</MenuItem>
    </>
  );
}

/** A found run in a bubble: the menu a press on it opens. */
function Detected({ text, kind }: { text: string; kind: DetectedKind }) {
  return (
    <Menu>
      <MenuTrigger
        render={<button type="button" className="mac-messages-detected" data-kind={kind} />}
      >
        {text}
      </MenuTrigger>
      <MenuPopup aria-label={text}>
        <DetectedRows text={text} kind={kind} from="messages" copyLabel={COPY_LABEL[kind]} />
      </MenuPopup>
    </Menu>
  );
}

/**
 * A message's text as a bubble shows it: its web addresses as links, and the addresses, phone numbers
 * and dates in it as text a press acts on. The text itself when nothing is found in it.
 */
export function detectedText(text: string): ReactNode {
  const runs = linkPieces(text).flatMap((piece) =>
    piece.href ? [{ text: piece.text, link: true, kind: null }] : detectedPieces(piece.text),
  ) as (DetectedPiece & { link?: boolean })[];
  if (runs.every((run) => run.kind === null && !run.link)) return text;
  return runs.map((run, index) => (
    // biome-ignore lint/suspicious/noArrayIndexKey: the runs of one text never reorder
    <Fragment key={index}>
      {run.link ? (
        linkedText(run.text, "messages")
      ) : run.kind ? (
        <Detected text={run.text} kind={run.kind} />
      ) : (
        run.text
      )}
    </Fragment>
  ));
}
