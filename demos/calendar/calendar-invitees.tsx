"use client";

import { BorderlessButton } from "macalicious/borderless-button";
import { Label } from "macalicious/label";
import { PushButton } from "macalicious/push-button";
import { TextField } from "macalicious/text-field";
import { type KeyboardEvent, useRef, useState } from "react";
import { flushSync } from "react-dom";
import { ADDRESS_DRAG_TYPE, accountOfDrag } from "../contacts/contacts-drag";
import { type ContactPerson, offeredPeople } from "../contacts/contacts-people";
import { type DesktopDragItem, useDesktopDrop } from "../desktop/desktop-drag";
import { type CalendarEntry, describe } from "./calendar-data";
import {
  type Answer,
  type AnswerStatus,
  type Invitation,
  InvitationError,
} from "./calendar-invitations";
import { describeRepeat } from "./calendar-recurrence";

/*
 * The invitees of an event in its popover: the organizer's list, which they add to by account
 * name and take people off, with each one's answer; and an invitation's own popover, which
 * reads the event and answers it.
 */

/** The most people one event invites (`MAX_INVITEES` in the module). */
export const MAX_INVITEES = 20;
/** The most events of one document that invite people (`MAX_INVITED_EVENTS` in the module). */
export const MAX_INVITED_EVENTS = 50;

/** This desktop's own mail addresses, as `mail-live.tsx` writes them. */
const OWN_MAIL = /^([^@\s]+)@macalicious$/i;

/** The account `address` names on this desktop, when it is one of this desktop's own addresses. */
export const accountOfAddress = (address: string): string =>
  OWN_MAIL.exec(address.trim())?.[1]?.toLowerCase() ?? "";

/** The account of a card from Contacts: the one it names, else the one its email address is. */
export const accountOfCard = (item: DesktopDragItem): string =>
  accountOfDrag(item) || accountOfAddress(item.name);

/** Why these addresses cannot be invited, one sentence for each. */
export const notInvitable = (addresses: readonly string[]): string =>
  addresses
    .map(
      (address) =>
        `“${address}” cannot be invited: invitations go between this desktop's accounts, and its Mail delivers only to them (name@macalicious).`,
    )
    .join(" ");

/** An answer, in words. */
export const STATUS_WORDS: Record<AnswerStatus, string> = {
  pending: "Not answered",
  accepted: "Accepted",
  declined: "Declined",
};

/** What the popover needs to invite people: the answers so far and a look-up of a name. */
export interface InviteesOptions {
  /** The answers of the people the saved event invites. */
  answers?: readonly Answer[];
  /** The account name of the person, who cannot invite themself. */
  ownName?: string;
  /** How many of the person's other events invite people. */
  invitedElsewhere?: number;
  /** A name was added: the document is to be saved as the window then shows it. */
  onAsked?: () => void;
  /** Looks an account up by its exact name. */
  lookup: (name: string) => Promise<{ name: string; fullName: string }>;
  /** The person's contacts with an account, offered as a name is typed. */
  people?: readonly ContactPerson[];
}

/** `url` when it is an http or https address, else `undefined`. */
export function webLink(url: string | undefined): string | undefined {
  if (!url) return undefined;
  try {
    const { protocol } = new URL(url);
    return protocol === "http:" || protocol === "https:" ? url : undefined;
  } catch {
    return undefined;
  }
}

/** What a failed look-up of `name` says to the person. */
function lookupFailure(error: unknown, name: string): string {
  if (error instanceof InvitationError && error.status === 404) {
    return `No one on this desktop has the account name “${name}”.`;
  }
  if (error instanceof InvitationError && error.status === 401) {
    return "Sign in to an account to invite people.";
  }
  return error instanceof Error && error.message
    ? error.message
    : "The account could not be looked up.";
}

/** The people the event invites, each with their answer, in a list. */
function InviteeList({
  names,
  answers,
  fullNames,
  onRemove,
}: {
  names: readonly string[];
  answers?: readonly Answer[];
  fullNames: Readonly<Record<string, string>>;
  onRemove?: (name: string) => void;
}) {
  return (
    <ul aria-label="Invitees" className="mac-calendar-invitees">
      {names.map((name) => {
        const answer = answers?.find((each) => each.name === name);
        const shown = answer?.fullName ?? fullNames[name] ?? name;
        return (
          <li key={name} className="mac-calendar-invitee">
            <span className="mac-calendar-invitee-name">{shown}</span>
            <Label color="secondary" className="mac-calendar-invitee-status">
              {answer ? STATUS_WORDS[answer.status] : "Invited when saved"}
            </Label>
            {onRemove ? (
              <PushButton size="mini" aria-label={`Remove ${shown}`} onClick={() => onRemove(name)}>
                Remove
              </PushButton>
            ) : null}
          </li>
        );
      })}
    </ul>
  );
}

/** The invitees row of the organizer's popover, read: a click opens it for editing. */
export function InviteesSummary({
  names,
  answers,
}: {
  names: readonly string[];
  answers?: readonly Answer[];
}) {
  return <InviteeList names={names} answers={answers} fullNames={{}} />;
}

/** The invitees row opened for editing: the list, a field for an account name, and Done. */
export function InviteesEditor({
  names,
  options,
  onChange,
  onDone,
}: {
  names: readonly string[];
  options: InviteesOptions;
  onChange: (names: string[]) => void;
  onDone: () => void;
}) {
  const [draft, setDraft] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [fullNames, setFullNames] = useState<Record<string, string>>({});
  // A card dragged from Contacts: its account is invited as if typed. An address outside this
  // desktop has no account to reach and no mail to reach it by.
  const dropRef = useDesktopDrop<HTMLDivElement>({
    accepts: (item) => item.type === ADDRESS_DRAG_TYPE && accountOfCard(item) !== "",
    refusal: (items) => notInvitable(items.map((item) => item.name)),
    sayRefusal: setError,
    onDrop: (taken, drag) => {
      void (async () => {
        for (const item of taken) await add(accountOfCard(item));
        const outside = drag.items.filter((item) => !taken.includes(item));
        if (outside.length > 0) setError(notInvitable(outside.map((item) => item.name)));
      })();
    },
  });
  // The names as they are now: someone removed while a name is looked up stays removed.
  const latest = useRef(names);
  latest.current = names;
  const offers = offeredPeople(options.people ?? [], draft, [
    ...names,
    ...(options.ownName ? [options.ownName] : []),
  ]);

  const add = async (typed = draft) => {
    const written = typed.trim().toLowerCase();
    if (!written || busy) return;
    if (written.includes("@") && !accountOfAddress(written)) {
      setError(notInvitable([written]));
      return;
    }
    const name = accountOfAddress(written) || written;
    if (names.includes(name)) {
      setError(`“${name}” is invited already.`);
      return;
    }
    if (name === options.ownName) {
      setError("You organize this event: invite someone else.");
      return;
    }
    if (names.length >= MAX_INVITEES) {
      setError(`An event invites at most ${MAX_INVITEES} people.`);
      return;
    }
    if (names.length === 0 && (options.invitedElsewhere ?? 0) >= MAX_INVITED_EVENTS) {
      setError(`At most ${MAX_INVITED_EVENTS} events invite other people.`);
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const found = await options.lookup(name);
      setFullNames((known) => ({ ...known, [found.name]: found.fullName }));
      // After an await this is no discrete event, so React would render it in a later task, and a
      // load's reply in between would replace the events with what the server holds, name and all.
      // Rendered now, it is saved in this task, and that reply merges it (`desktop-server.ts`).
      if (!latest.current.includes(found.name)) {
        flushSync(() => onChange([...latest.current, found.name]));
      }
      setDraft("");
    } catch (failure) {
      setError(lookupFailure(failure, name));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div ref={dropRef} className="mac-calendar-popover-row mac-calendar-editor" data-row="invitees">
      {names.length > 0 ? (
        <InviteeList
          names={names}
          answers={options.answers}
          fullNames={fullNames}
          onRemove={(name) => onChange(names.filter((each) => each !== name))}
        />
      ) : null}
      <TextField
        aria-label="Invitee"
        placeholder="Account name"
        size="small"
        value={draft}
        autoComplete="off"
        spellCheck={false}
        autoFocus
        onValueChange={(value) => {
          setDraft(value);
          setError(null);
        }}
        onKeyDown={(event: KeyboardEvent) => {
          if (event.key === "Enter") {
            event.preventDefault();
            void add();
          }
        }}
      />
      {offers.length > 0 ? (
        <fieldset aria-label="Contacts" className="mac-calendar-invitee-offers">
          {offers.map(({ name, to }) => (
            <BorderlessButton key={to} disabled={busy} onClick={() => void add(to)}>
              {name}
            </BorderlessButton>
          ))}
        </fieldset>
      ) : null}
      {error ? (
        <p role="alert" className="mac-calendar-invitee-error">
          {error}
        </p>
      ) : null}
      <div className="mac-calendar-invitee-actions">
        <PushButton size="small" disabled={busy || draft.trim() === ""} onClick={() => void add()}>
          Invite
        </PushButton>
        <PushButton size="small" onClick={onDone}>
          Done
        </PushButton>
      </div>
    </div>
  );
}

/** An invitation's popover: the event as its organizer saved it, who is invited, and the answer. */
export function InvitationDetails({
  invitation,
  entry,
  onRespond,
}: {
  invitation: Invitation;
  /** The occurrence shown, of the invitation's event. */
  entry: CalendarEntry;
  onRespond: (accept: boolean) => Promise<void>;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Another account wrote the address: only a web link is offered.
  const link = webLink(entry.url);
  const answer = async (accept: boolean) => {
    setBusy(true);
    setError(null);
    try {
      await onRespond(accept);
    } catch (failure) {
      setError(
        failure instanceof InvitationError && failure.status === 404
          ? "This invitation was taken back."
          : failure instanceof InvitationError && failure.status === 409
            ? "The event changed since you looked. Look at it again before you answer."
            : failure instanceof Error && failure.message
              ? failure.message
              : "The answer could not be sent.",
      );
    } finally {
      setBusy(false);
    }
  };
  return (
    <>
      <div className="mac-calendar-popover-head">
        <div className="mac-calendar-popover-name">
          <Label textStyle="title-2">{entry.title}</Label>
          {entry.location ? <Label color="secondary">{entry.location}</Label> : null}
        </div>
      </div>
      <div className="mac-calendar-popover-row">
        {describe(entry)}
        {entry.repeat ? (
          <div className="mac-calendar-popover-detail">{describeRepeat(entry.repeat)}</div>
        ) : null}
      </div>
      <div className="mac-calendar-popover-row" data-row="invitees">
        <div>Organizer: {invitation.organizer.fullName}</div>
        <InviteeList
          names={invitation.invitees.map((each) => each.name)}
          answers={invitation.invitees}
          fullNames={{}}
        />
      </div>
      {entry.notes || link ? (
        <div className="mac-calendar-popover-row" data-row="notes">
          {entry.notes ? <div className="mac-calendar-popover-notes">{entry.notes}</div> : null}
          {link ? (
            <a
              className="mac-calendar-popover-url"
              href={link}
              target="_blank"
              rel="noreferrer noopener"
            >
              {link}
            </a>
          ) : null}
        </div>
      ) : null}
      <div className="mac-calendar-popover-row mac-calendar-invitee-actions" data-row="answer">
        <PushButton
          size="small"
          disabled={busy}
          aria-pressed={invitation.status === "accepted"}
          onClick={() => void answer(true)}
        >
          Accept
        </PushButton>
        <PushButton
          size="small"
          disabled={busy}
          aria-pressed={invitation.status === "declined"}
          onClick={() => void answer(false)}
        >
          Decline
        </PushButton>
        {error ? (
          <p role="alert" className="mac-calendar-invitee-error">
            {error}
          </p>
        ) : null}
      </div>
    </>
  );
}
