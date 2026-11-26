"use client";

import { DefaultButton } from "macalicious/default-button";
import { Label } from "macalicious/label";
import { MenuItem, MenuSeparator } from "macalicious/menu-item";
import { PopUpButton, PopUpButtonItem } from "macalicious/pop-up-button";
import { PushButton } from "macalicious/push-button";
import {
  Sheet,
  SheetActions,
  SheetClose,
  SheetDescription,
  SheetPopup,
  type SheetPopupProps,
  SheetTitle,
} from "macalicious/sheet";
import { TextField } from "macalicious/text-field";
import { useEffect, useId, useState } from "react";
import { lastSeen, type ServedPerson, type ServedRule } from "./find-my-server";

/*
 * Find My's People: what a person's row says, their card over the map, their contextual menu, and
 * the sheets that start sharing and ask for a notification. The links themselves are the module's
 * (`ferrite-apps/desktop/src/apps/find_my/people.rs`).
 */

/** A person's row id in the People list, apart from "me". */
export const personRowId = (name: string) => `person:${name}`;

/** Who a contact card has to be to share with them. */
export const NO_ACCOUNT = (name: string) => `${name} has no account on this desktop.`;

/** The second line of a person's row. */
export function personDetail(person: ServedPerson, now: number): string {
  if (person.position) return lastSeen(person.position.at, now);
  if (person.following) return "No location found";
  if (person.asks_me) return "Asks to follow your location";
  if (person.sharing) return "Can see your location";
  return "Asked to follow their location";
}

/** The initials on a person's disc. */
export function initialsOf(fullName: string): string {
  return fullName
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((word) => word[0]?.toUpperCase() ?? "")
    .join("");
}

/** What a rule asks, in a sentence. */
export function ruleText(person: ServedPerson, rule: ServedRule): string {
  const verb = rule.kind === "arrive" ? "arrives at" : "leaves";
  return `Notify me when ${person.full_name} ${verb} ${rule.label}${rule.repeat ? ", every time" : ""}`;
}

/** What a rule on oneself asks, in a sentence. */
export function tellText(person: ServedPerson, rule: ServedRule): string {
  const verb = rule.kind === "arrive" ? "arrive at" : "leave";
  return `Notify ${person.full_name} when I ${verb} ${rule.label}${rule.repeat ? ", every time" : ""}`;
}

/** What a person's card and contextual menu can do. */
export interface PersonActions {
  contact: (person: ServedPerson) => void;
  message: (person: ServedPerson) => void;
  directions: (person: ServedPerson) => void;
  share: (person: ServedPerson) => void;
  stopSharing: (person: ServedPerson) => void;
  ask: (person: ServedPerson) => void;
  decline: (person: ServedPerson) => void;
  notify: (person: ServedPerson) => void;
  removeRule: (person: ServedPerson) => void;
  removeTell: (person: ServedPerson) => void;
  remove: (person: ServedPerson) => void;
}

/** The contextual menu of another person's row, or of their marker on the map. */
export function FriendMenuItems({
  person,
  actions,
}: {
  person: ServedPerson;
  actions: PersonActions;
}) {
  return (
    <>
      <MenuItem onClick={() => actions.contact(person)}>Contact</MenuItem>
      <MenuItem onClick={() => actions.message(person)}>Message</MenuItem>
      <MenuItem
        disabled={!person.position}
        title={person.position ? undefined : `${person.full_name} has no location to go to.`}
        onClick={() => actions.directions(person)}
      >
        Directions
      </MenuItem>
      <MenuSeparator />
      {person.sharing ? (
        <MenuItem onClick={() => actions.stopSharing(person)}>Stop Sharing My Location</MenuItem>
      ) : (
        <MenuItem onClick={() => actions.share(person)}>Share My Location</MenuItem>
      )}
      {person.following ? null : (
        <MenuItem
          disabled={person.asked}
          title={person.asked ? `${person.full_name} has not answered yet.` : undefined}
          onClick={() => actions.ask(person)}
        >
          Ask To Follow Location
        </MenuItem>
      )}
      <MenuItem
        disabled={!person.following && !person.sharing}
        title={
          person.following || person.sharing
            ? undefined
            : "Only someone you share a location with can be notified."
        }
        onClick={() => actions.notify(person)}
      >
        Add Notification…
      </MenuItem>
      <MenuSeparator />
      <MenuItem onClick={() => actions.remove(person)}>Remove {person.full_name}</MenuItem>
    </>
  );
}

/** The card of the chosen person, over the map. */
export function PersonCard({
  person,
  now,
  place,
  actions,
}: {
  person: ServedPerson;
  now: number;
  /** The distance from here, already written. */
  place: string | null;
  actions: PersonActions;
}) {
  return (
    <section className="mac-find-my-device-card" aria-label={person.full_name}>
      <h2 className="mac-find-my-device-name">{person.full_name}</h2>
      <Label render={<p />} textStyle="small" color="secondary">
        {personDetail(person, now)}
        {place ? ` · ${place}` : ""}
        {person.following && person.sharing ? " · You share with each other" : ""}
      </Label>
      {person.asks_me ? (
        <Label render={<p />} textStyle="small">
          {person.full_name} asked to follow your location.
        </Label>
      ) : null}
      {person.rule ? (
        <Label render={<p />} textStyle="small" color="secondary">
          {ruleText(person, person.rule)}
        </Label>
      ) : null}
      {person.tell ? (
        <Label render={<p />} textStyle="small" color="secondary">
          {tellText(person, person.tell)}
        </Label>
      ) : null}
      <div className="mac-find-my-device-actions">
        <PushButton size="small" onClick={() => actions.contact(person)}>
          Contact
        </PushButton>
        <PushButton size="small" onClick={() => actions.message(person)}>
          Message
        </PushButton>
        {person.position ? (
          <PushButton size="small" onClick={() => actions.directions(person)}>
            Directions
          </PushButton>
        ) : null}
        {person.sharing ? (
          <PushButton size="small" onClick={() => actions.stopSharing(person)}>
            Stop Sharing My Location
          </PushButton>
        ) : (
          <PushButton size="small" onClick={() => actions.share(person)}>
            Share My Location
          </PushButton>
        )}
        {person.asks_me ? (
          <PushButton size="small" onClick={() => actions.decline(person)}>
            Don’t Share
          </PushButton>
        ) : null}
        {!person.following && !person.asked ? (
          <PushButton size="small" onClick={() => actions.ask(person)}>
            Ask To Follow Location
          </PushButton>
        ) : null}
        {(person.following && !person.rule) || (person.sharing && !person.tell) ? (
          <PushButton size="small" onClick={() => actions.notify(person)}>
            Add Notification…
          </PushButton>
        ) : null}
        {person.rule ? (
          <PushButton size="small" onClick={() => actions.removeRule(person)}>
            Remove Notification
          </PushButton>
        ) : null}
        {person.tell ? (
          <PushButton size="small" onClick={() => actions.removeTell(person)}>
            Stop Notifying {person.full_name}
          </PushButton>
        ) : null}
        <PushButton size="small" onClick={() => actions.remove(person)}>
          Remove
        </PushButton>
      </div>
    </section>
  );
}

/** The sheet Share My Location opens: who to share with. */
export function ShareSheet({
  open,
  anchor,
  send,
  onClose,
}: {
  open: boolean;
  anchor: SheetPopupProps["anchor"];
  /** Starts sharing: `null`, or why it did not. */
  send: (typed: string) => Promise<string | null>;
  onClose: () => void;
}) {
  const [typed, setTyped] = useState("");
  const [problem, setProblem] = useState<string | null>(null);
  const [sending, setSending] = useState(false);
  useEffect(() => {
    if (open) {
      setTyped("");
      setProblem(null);
    }
  }, [open]);
  const submit = async () => {
    setSending(true);
    const why = await send(typed);
    setSending(false);
    if (why) setProblem(why);
    else onClose();
  };
  return (
    <Sheet open={open} onOpenChange={(next) => next || onClose()}>
      <SheetPopup anchor={anchor} width={420}>
        <SheetTitle>Share My Location</SheetTitle>
        <SheetDescription>
          Name someone with an account on this desktop. They see where your devices are until you
          stop sharing.
        </SheetDescription>
        <TextField
          aria-label="To"
          placeholder="Account name"
          value={typed}
          onValueChange={setTyped}
          onKeyDown={(event) => {
            if (event.key === "Enter" && typed.trim() !== "" && !sending) {
              event.preventDefault();
              void submit();
            }
          }}
        />
        {problem ? (
          <Label role="alert" render={<p />} textStyle="small">
            {problem}
          </Label>
        ) : null}
        <SheetActions>
          <SheetClose>Cancel</SheetClose>
          <DefaultButton disabled={typed.trim() === "" || sending} onClick={() => void submit()}>
            Send
          </DefaultButton>
        </SheetActions>
      </SheetPopup>
    </Sheet>
  );
}

/** What the sheet asks for: who is told, of what, and at where. `place` is `null` for here. */
export interface NewRule {
  who: "me" | "them";
  kind: ServedRule["kind"];
  repeat: boolean;
  place: string | null;
}

/** The sheet Add Notification opens: whom to tell, when, and at which place. */
export function NotifySheet({
  person,
  anchor,
  hasPlace,
  send,
  onClose,
}: {
  person: ServedPerson | null;
  anchor: SheetPopupProps["anchor"];
  /** Whether this browser knows where it is, which is the place "current location" names. */
  hasPlace: boolean;
  send: (rule: NewRule) => void;
  onClose: () => void;
}) {
  const [choice, setWho] = useState<NewRule["who"]>("me");
  const [kind, setKind] = useState<ServedRule["kind"]>("arrive");
  const [repeat, setRepeat] = useState(false);
  const [where, setWhere] = useState<"here" | "other">("here");
  const [place, setPlace] = useState("");
  const whoId = useId();
  const whenId = useId();
  const whereId = useId();
  const howId = useId();
  // Only what can be: a follower is told about someone who shares, and the other way round.
  const who: NewRule["who"] = person?.following ? (person.sharing ? choice : "me") : "them";
  const ready = where === "here" ? hasPlace : place.trim() !== "";
  return (
    <Sheet open={person !== null} onOpenChange={(next) => next || onClose()}>
      <SheetPopup anchor={anchor} width={420}>
        <SheetTitle>Add Notification</SheetTitle>
        <SheetDescription>
          {where === "here" && !hasPlace
            ? "Find My needs your current location, which this browser has not given. Name another place."
            : who === "me"
              ? `Notify you about ${person?.full_name ?? ""}.`
              : `Notify ${person?.full_name ?? ""} about you.`}
        </SheetDescription>
        <div className="mac-find-my-device-actions">
          <Label id={whoId}>Notify:</Label>
          <PopUpButton
            aria-labelledby={whoId}
            value={who}
            disabled={!person?.following || !person?.sharing}
            onValueChange={(value) => setWho(value as NewRule["who"])}
          >
            <PopUpButtonItem value="me">Me</PopUpButtonItem>
            <PopUpButtonItem value="them">{person?.full_name ?? ""}</PopUpButtonItem>
          </PopUpButton>
          <Label id={whenId}>When:</Label>
          <PopUpButton
            aria-labelledby={whenId}
            value={kind}
            onValueChange={(value) => setKind(value as ServedRule["kind"])}
          >
            <PopUpButtonItem value="arrive">
              {who === "me" ? "Arrives" : "I Arrive"}
            </PopUpButtonItem>
            <PopUpButtonItem value="leave">{who === "me" ? "Leaves" : "I Leave"}</PopUpButtonItem>
          </PopUpButton>
          <Label id={whereId}>Where:</Label>
          <PopUpButton
            aria-labelledby={whereId}
            value={where}
            onValueChange={(value) => setWhere(value as "here" | "other")}
          >
            <PopUpButtonItem value="here">Current Location</PopUpButtonItem>
            <PopUpButtonItem value="other">Another Place</PopUpButtonItem>
          </PopUpButton>
          {where === "other" ? (
            <TextField
              aria-label="Place"
              placeholder="Enter a place"
              value={place}
              onValueChange={setPlace}
            />
          ) : null}
          <Label id={howId}>How often:</Label>
          <PopUpButton
            aria-labelledby={howId}
            value={repeat ? "every" : "once"}
            onValueChange={(value) => setRepeat(value === "every")}
          >
            <PopUpButtonItem value="once">Only Once</PopUpButtonItem>
            <PopUpButtonItem value="every">Every Time</PopUpButtonItem>
          </PopUpButton>
        </div>
        <SheetActions>
          <SheetClose>Cancel</SheetClose>
          <DefaultButton
            disabled={!ready}
            onClick={() => {
              send({ who, kind, repeat, place: where === "other" ? place.trim() : null });
              onClose();
            }}
          >
            Add
          </DefaultButton>
        </SheetActions>
      </SheetPopup>
    </Sheet>
  );
}
