"use client";

import { Label } from "macalicious/label";
import { Popover, PopoverPopup, PopoverSeparator, PopoverTitle } from "macalicious/popover";
import { PushButton } from "macalicious/push-button";
import { TextField } from "macalicious/text-field";
import { type CSSProperties, type FormEvent, useId, useState } from "react";
import type { SharedPerson } from "./reminders-shared";

/** As captured for the info popover: the opaque material. */
const POPUP_OPAQUE = {
  "--mac-material-popover": "var(--mac-material-popover-opaque)",
} as CSSProperties;

const NO_ONE: readonly SharedPerson[] = [];

export interface ReminderShareProps {
  /** The list's name. */
  listName: string;
  /** Who owns the list once it is shared; absent for a list that is not shared yet. */
  owner?: SharedPerson;
  /**
   * Everyone else on the list.
   * @default []
   */
  members?: readonly SharedPerson[];
  /**
   * Whether the person owns the list (always, for one that is not shared yet): only the owner
   * adds and removes people.
   * @default true
   */
  owned?: boolean;
  /** The person's own account name, whose row offers Leave. */
  me?: string;
  /** What the popover's arrow points at: the list's row. */
  anchor: Element | null;
  /**
   * The popover's surface, as on the info popover.
   * @default "translucent"
   */
  material?: "translucent" | "opaque";
  /** Adds the account named by its argument: resolves to why it could not, or `null`. */
  onAdd: (name: string) => Promise<string | null>;
  /** Takes the named account off the list (the person's own: leaves it), as `onAdd` resolves. */
  onRemove: (name: string) => Promise<string | null>;
  /** The owner stops sharing the list, as `onAdd` resolves; absent for a list not shared yet. */
  onStop?: () => Promise<string | null>;
  /** Called when the popover is dismissed: Escape, or a press outside it. */
  onClose: () => void;
}

/**
 * Share List: the people on a list, and a field that adds an account by its exact account name.
 * The owner adds and removes people and can stop sharing the list; anyone on the list can leave
 * it, the owner too while someone else is on it (who then owns it). Open while rendered.
 */
export function ReminderShare({
  listName,
  owner,
  members = NO_ONE,
  owned = true,
  me,
  anchor,
  material = "translucent",
  onAdd,
  onRemove,
  onStop,
  onClose,
}: ReminderShareProps) {
  const id = useId();
  const [name, setName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const act = async (run: () => Promise<string | null>) => {
    setBusy(true);
    setError(null);
    const failed = await run();
    setBusy(false);
    setError(failed);
    if (failed === null) setName("");
  };
  const submit = (event: FormEvent) => {
    event.preventDefault();
    const who = name.trim();
    if (who && !busy) void act(() => onAdd(who));
  };
  const people = owner ? [owner, ...members] : [];
  return (
    <Popover
      open
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
    >
      <PopoverPopup
        side="right"
        anchor={anchor}
        className="mac-reminders-share"
        style={material === "opaque" ? POPUP_OPAQUE : undefined}
      >
        <PopoverTitle className="mac-reminders-share-title">Share “{listName}”</PopoverTitle>
        {people.length > 0 ? (
          <ul className="mac-reminders-share-people" aria-label="People on this list">
            {people.map((person) => (
              <li key={person.name} className="mac-reminders-share-person">
                <span className="mac-reminders-share-name">
                  {person.fullName}
                  <Label color="secondary" className="mac-reminders-share-detail">
                    {person === owner ? "Owner" : person.name}
                  </Label>
                </span>
                {(
                  person === owner
                    ? person.name === me && members.length > 0
                    : owned || person.name === me
                ) ? (
                  <PushButton
                    size="small"
                    disabled={busy}
                    aria-label={
                      person.name === me ? "Leave this list" : `Remove ${person.fullName}`
                    }
                    onClick={() => void act(() => onRemove(person.name))}
                  >
                    {person.name === me ? "Leave" : "Remove"}
                  </PushButton>
                ) : null}
              </li>
            ))}
          </ul>
        ) : null}
        {owned ? (
          <>
            {people.length > 0 ? <PopoverSeparator className="mac-reminders-share-line" /> : null}
            <form className="mac-reminders-share-form" onSubmit={submit}>
              <Label id={`${id}a`} color="secondary" className="mac-reminders-share-hint">
                Add a person by their account name.
              </Label>
              <TextField
                className="mac-reminders-share-field"
                aria-labelledby={`${id}a`}
                placeholder="Account name"
                autoComplete="off"
                value={name}
                onValueChange={(next) => {
                  setName(next);
                  setError(null);
                }}
              />
              <PushButton
                type="submit"
                variant="primary"
                className="mac-reminders-share-submit"
                disabled={busy || name.trim() === ""}
              >
                {owner ? "Add" : "Share"}
              </PushButton>
            </form>
          </>
        ) : null}
        {owned && owner && onStop ? (
          <>
            <PopoverSeparator className="mac-reminders-share-line" />
            <div className="mac-reminders-share-stop">
              <PushButton size="small" disabled={busy} onClick={() => void act(onStop)}>
                Stop Sharing
              </PushButton>
            </div>
          </>
        ) : null}
        {error ? (
          <p role="alert" className="mac-reminders-share-error">
            {error}
          </p>
        ) : null}
      </PopoverPopup>
    </Popover>
  );
}
