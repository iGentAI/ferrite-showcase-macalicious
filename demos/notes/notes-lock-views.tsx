"use client";

import { DefaultButton } from "macalicious/default-button";
import { Label } from "macalicious/label";
import { PushButton } from "macalicious/push-button";
import { SecureTextField } from "macalicious/secure-text-field";
import { Sheet, SheetActions, SheetPopup, SheetTitle } from "macalicious/sheet";
import { TextField } from "macalicious/text-field";
import { type FormEvent, useId, useState } from "react";
import { LockGlyph } from "./notes-glyphs";
import { FORGOTTEN_PASSWORD_LOSES_TEXT, type LockResult, notesLock } from "./notes-lock";

/** What a window asks the person for before a change to a lock. */
export type LockAsk =
  | { kind: "create"; noteId: string; reset?: boolean }
  | { kind: "enter"; noteId: string; next: "lock" | "remove" }
  | { kind: "change" };

const TITLES: Record<LockAsk["kind"], string> = {
  create: "Create a Password",
  enter: "Enter the Notes Password",
  change: "Change Password",
};

const RESET_SAYS =
  "The new password is for notes you lock from now on. Notes already locked keep the old password, and without it their text is lost.";

/** What the sheet says went wrong, with the password hint when there is one. */
function Failure({ failure }: { failure: Extract<LockResult, { ok: false }> | null }) {
  if (!failure) return null;
  return (
    <Label textStyle="small" role="alert" render={<p />}>
      {failure.reason}
      {failure.hint ? ` Password hint: ${failure.hint}` : ""}
    </Label>
  );
}

/** One sheet's fields and buttons. Built anew for each thing asked. */
function LockSheetForm({
  ask,
  onAsk,
  onClose,
}: {
  ask: LockAsk;
  onAsk: (next: LockAsk) => void;
  onClose: () => void;
}) {
  const id = useId();
  const [oldPassword, setOldPassword] = useState("");
  const [password, setPassword] = useState("");
  const [verify, setVerify] = useState("");
  const [hint, setHint] = useState("");
  const [busy, setBusy] = useState(false);
  const [failure, setFailure] = useState<Extract<LockResult, { ok: false }> | null>(null);
  const makesPassword = ask.kind !== "enter";
  const mismatch = makesPassword && verify !== "" && password !== verify;
  const hintGivesItAway = makesPassword && hint !== "" && hint === password;
  const ready =
    password !== "" &&
    !busy &&
    (!makesPassword || (password === verify && !hintGivesItAway)) &&
    (ask.kind !== "change" || oldPassword !== "");

  const carryOut = (): Promise<LockResult> => {
    const newHint = hint.trim() || undefined;
    if (ask.kind === "create") {
      return notesLock.lock(ask.noteId, { password, hint: newHint, create: true });
    }
    if (ask.kind === "change") return notesLock.changePassword(oldPassword, password, newHint);
    if (ask.next === "lock") return notesLock.lock(ask.noteId, { password });
    return notesLock
      .unlock(ask.noteId, password)
      .then((opened) => (opened.ok ? notesLock.removeLock(ask.noteId) : opened));
  };

  const submit = (event: FormEvent) => {
    event.preventDefault();
    if (!ready) return;
    setBusy(true);
    setFailure(null);
    void carryOut().then((result) => {
      setBusy(false);
      if (result.ok) onClose();
      else setFailure(result);
    });
  };

  return (
    <form className="mac-notes-lock-sheet" onSubmit={submit}>
      <SheetTitle>{TITLES[ask.kind]}</SheetTitle>
      <div className="mac-notes-lock-fields">
        {ask.kind === "change" ? (
          <>
            <Label id={`${id}old`} align="end">
              Old Password:
            </Label>
            <SecureTextField
              aria-labelledby={`${id}old`}
              autoFocus
              value={oldPassword}
              onChange={(event) => setOldPassword(event.currentTarget.value)}
            />
          </>
        ) : null}
        <Label id={`${id}new`} align="end">
          {ask.kind === "change" ? "New Password:" : "Password:"}
        </Label>
        <SecureTextField
          aria-labelledby={`${id}new`}
          autoFocus={ask.kind !== "change"}
          value={password}
          onChange={(event) => setPassword(event.currentTarget.value)}
        />
        {makesPassword ? (
          <>
            <Label id={`${id}verify`} align="end">
              Verify:
            </Label>
            <SecureTextField
              aria-labelledby={`${id}verify`}
              value={verify}
              onChange={(event) => setVerify(event.currentTarget.value)}
            />
            <Label id={`${id}hint`} align="end">
              Password Hint:
            </Label>
            <TextField
              aria-labelledby={`${id}hint`}
              value={hint}
              maxLength={200}
              onValueChange={setHint}
              placeholder="Recommended"
            />
          </>
        ) : null}
      </div>
      {mismatch ? (
        <Label textStyle="small" role="alert" render={<p />}>
          The passwords don’t match.
        </Label>
      ) : null}
      {hintGivesItAway ? (
        <Label textStyle="small" role="alert" render={<p />}>
          The hint can’t be the password.
        </Label>
      ) : null}
      <Failure failure={failure} />
      <Label textStyle="small" color="secondary" render={<p />}>
        <strong>Important:</strong> {FORGOTTEN_PASSWORD_LOSES_TEXT}
      </Label>
      {ask.kind === "create" && ask.reset ? (
        <Label textStyle="small" color="secondary" render={<p />}>
          {RESET_SAYS}
        </Label>
      ) : null}
      <SheetActions>
        {ask.kind === "enter" && ask.next === "lock" ? (
          <PushButton
            type="button"
            onClick={() => onAsk({ kind: "create", noteId: ask.noteId, reset: true })}
          >
            Reset Password…
          </PushButton>
        ) : null}
        <PushButton type="button" onClick={onClose}>
          Cancel
        </PushButton>
        <DefaultButton type="submit" disabled={!ready}>
          OK
        </DefaultButton>
      </SheetActions>
    </form>
  );
}

/** The sheet a window shows while it asks for a password. */
export function NotesLockSheet({
  ask,
  anchor,
  onAsk,
  onClose,
}: {
  ask: LockAsk | null;
  anchor: HTMLElement | null;
  onAsk: (next: LockAsk) => void;
  onClose: () => void;
}) {
  return (
    <Sheet open={ask !== null} onOpenChange={(open) => open || onClose()}>
      <SheetPopup anchor={anchor} width={460} aria-label={ask ? TITLES[ask.kind] : undefined}>
        {ask ? (
          <LockSheetForm
            key={`${ask.kind}${ask.kind === "create" && ask.reset ? "-reset" : ""}`}
            ask={ask}
            onAsk={onAsk}
            onClose={onClose}
          />
        ) : null}
      </SheetPopup>
    </Sheet>
  );
}

/** What stands in a locked note's place until its password is entered. */
export function LockedNotePane({ noteId }: { noteId: string }) {
  const id = useId();
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [failure, setFailure] = useState<Extract<LockResult, { ok: false }> | null>(null);
  return (
    <form
      className="mac-notes-locked"
      aria-label="Locked note"
      onSubmit={(event) => {
        event.preventDefault();
        if (password === "" || busy) return;
        setBusy(true);
        setFailure(null);
        void notesLock.unlock(noteId, password).then((result) => {
          setBusy(false);
          setPassword("");
          if (!result.ok) setFailure(result);
        });
      }}
    >
      <span className="mac-notes-locked-glyph">
        <LockGlyph />
      </span>
      <Label render={<p />}>This note is locked.</Label>
      <Label id={`${id}label`} textStyle="small" color="secondary" render={<p />}>
        Enter the notes password to view this note.
      </Label>
      <SecureTextField
        aria-labelledby={`${id}label`}
        value={password}
        style={{ width: 200 }}
        onChange={(event) => setPassword(event.currentTarget.value)}
      />
      <Failure failure={failure} />
      <Label textStyle="small" color="secondary" render={<p />}>
        {FORGOTTEN_PASSWORD_LOSES_TEXT}
      </Label>
    </form>
  );
}
