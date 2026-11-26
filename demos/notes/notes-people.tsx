import { PopoverDescription, PopoverTitle } from "macalicious/popover";
import { PushButton } from "macalicious/push-button";
import { TextField } from "macalicious/text-field";
import { type FormEvent, useState } from "react";
import type { NotesNote } from "./notes-data";
import {
  addPerson,
  leaveNote,
  removePerson,
  type SharedNote,
  type SharedState,
  stopSharing,
} from "./notes-shared";

export interface NotePeopleProps {
  /** The note shown. */
  note: NotesNote | null;
  shared: SharedState;
  /** Share the note shown, which is the person's own, with an account; why it failed, or `null`. */
  onShare: (name: string) => Promise<string | null>;
}

/** A field for an account name, with why the last try failed. */
function AddAccount({
  label,
  add,
}: {
  label: string;
  add: (name: string) => Promise<string | null>;
}) {
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  const [failure, setFailure] = useState<string | null>(null);
  const submit = async (event: FormEvent) => {
    event.preventDefault();
    const wanted = name.trim();
    if (!wanted || busy) return;
    setBusy(true);
    setFailure(null);
    const why = await add(wanted);
    setBusy(false);
    setFailure(why);
    if (!why) setName("");
  };
  return (
    <form className="mac-notes-people-add" onSubmit={(event) => void submit(event)}>
      <TextField
        aria-label="Account name"
        placeholder="Account name"
        autoComplete="off"
        value={name}
        onChange={(event) => setName(event.target.value)}
      />
      <PushButton type="submit" disabled={busy || name.trim() === ""}>
        {label}
      </PushButton>
      {failure ? (
        <p className="mac-notes-people-failure" role="alert">
          {failure}
        </p>
      ) : null}
    </form>
  );
}

/** The people on a shared note, and what the person may do with it. */
function SharedPeople({ entry, shared }: { entry: SharedNote; shared: SharedState }) {
  const [failure, setFailure] = useState<string | null>(null);
  const run = async (action: Promise<string | null>) => setFailure(await action);
  return (
    <>
      <ul className="mac-notes-people" aria-label="People on this note">
        <li>
          <span>{entry.owner.fullName}</span>
          <span className="mac-notes-people-role">Owner</span>
        </li>
        {entry.members.map((person) => (
          <li key={person.name}>
            <span>{person.fullName}</span>
            {entry.owned ? (
              <PushButton
                size="small"
                aria-label={`Remove ${person.fullName}`}
                onClick={() => void run(removePerson(entry.id, person.name))}
              >
                Remove
              </PushButton>
            ) : person.name === shared.me ? (
              <span className="mac-notes-people-role">You</span>
            ) : null}
          </li>
        ))}
      </ul>
      {failure ? (
        <p className="mac-notes-people-failure" role="alert">
          {failure}
        </p>
      ) : null}
      {entry.owned ? (
        <>
          <AddAccount label="Add" add={(name) => addPerson(entry.id, name)} />
          <PushButton onClick={() => void run(stopSharing(entry.id))}>Stop Sharing</PushButton>
        </>
      ) : (
        <PushButton onClick={() => void run(leaveNote(entry.id))}>Leave Note</PushButton>
      )}
    </>
  );
}

/** What the toolbar's Add People shows, for the note shown. */
export function NotePeople({ note, shared, onShare }: NotePeopleProps) {
  const entry = note ? shared.notes.find((each) => each.id === note.id) : undefined;
  return (
    <>
      <PopoverTitle>Add People</PopoverTitle>
      {entry ? (
        <SharedPeople entry={entry} shared={shared} />
      ) : !shared.canShare ? (
        <PopoverDescription>
          Sharing a note needs a signed-in account on this desktop. A Guest User’s notes stay here.
        </PopoverDescription>
      ) : note?.locked ? (
        <PopoverDescription>A locked note can’t be shared.</PopoverDescription>
      ) : note?.deleted !== undefined ? (
        <PopoverDescription>Recover the note before you share it.</PopoverDescription>
      ) : (
        <>
          <PopoverDescription>
            Name an account on this desktop. You can both edit the note, and it moves to Shared.
          </PopoverDescription>
          <AddAccount label="Share" add={onShare} />
        </>
      )}
    </>
  );
}
