"use client";

import { BorderlessButton } from "macalicious/borderless-button";
import { PushButton } from "macalicious/push-button";
import { TextField } from "macalicious/text-field";
import { useEffect, useRef, useState } from "react";
import { type ContactPerson, offeredPeople } from "../contacts/contacts-people";

export interface AddPersonProps {
  /** Who the field offers as it is typed: the person's Contacts that name a desktop account. */
  people: readonly ContactPerson[];
  /** The account names already on the call, which the field does not offer. */
  taken: readonly string[];
  /** Whether the field shows, in place of the button. */
  open: boolean;
  /** Why the button is dimmed, when it is. */
  unavailable?: string;
  onOpenChange: (open: boolean) => void;
  /** Called with the account name, or the words typed, to add. */
  onAdd: (to: string) => void;
}

/**
 * The call panel's Add Person: a button, then a field that offers the person's Contacts as it is
 * typed, as the window's recipient field does. It stays open until the person is added or Cancel
 * is pressed, so a refusal leaves what was typed there to correct.
 */
export function AddPerson({
  people,
  taken,
  open,
  unavailable,
  onOpenChange,
  onAdd,
}: AddPersonProps) {
  const [typed, setTyped] = useState("");
  const field = useRef<HTMLInputElement>(null);
  useEffect(() => {
    if (open) field.current?.focus();
    else setTyped("");
  }, [open]);
  if (!open) {
    return (
      <PushButton
        size="small"
        disabled={unavailable !== undefined}
        title={unavailable}
        onClick={() => onOpenChange(true)}
      >
        Add Person
      </PushButton>
    );
  }
  const to = typed.trim();
  const offered = offeredPeople(people, to, [...taken, to]);
  return (
    <div className="mac-facetime-add">
      {offered.length > 0 ? (
        <fieldset aria-label="Contacts" className="mac-facetime-suggestions">
          {offered.map((person) => (
            <BorderlessButton
              key={person.to}
              onClick={() => {
                setTyped(person.to);
                field.current?.focus();
              }}
            >
              {person.name}
            </BorderlessButton>
          ))}
        </fieldset>
      ) : null}
      <div className="mac-facetime-add-row">
        <TextField
          aria-label="Person to add"
          className="mac-facetime-add-field"
          size="small"
          inputRef={field}
          placeholder="Enter a name"
          autoComplete="off"
          spellCheck={false}
          value={typed}
          onValueChange={(next) => setTyped(next)}
          onKeyDown={(event) => {
            if (event.key === "Escape") {
              onOpenChange(false);
              return;
            }
            // A Return that ends a composition only confirms it, as in the recipient field.
            if (event.key !== "Enter" || event.nativeEvent.isComposing || event.keyCode === 229) {
              return;
            }
            event.preventDefault();
            if (to) onAdd(to);
          }}
        />
        <PushButton size="small" disabled={to === ""} onClick={() => onAdd(to)}>
          Add
        </PushButton>
        <PushButton size="small" onClick={() => onOpenChange(false)}>
          Cancel
        </PushButton>
      </div>
    </div>
  );
}
