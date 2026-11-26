"use client";

import { DefaultButton } from "macalicious/default-button";
import { Label } from "macalicious/label";
import { PopUpButton, PopUpButtonItem } from "macalicious/pop-up-button";
import { PushButton } from "macalicious/push-button";
import { SecureTextField } from "macalicious/secure-text-field";
import { SheetTitle } from "macalicious/sheet";
import { TextField } from "macalicious/text-field";
import { useEffect, useState } from "react";
import type { PreviewFolder } from "./preview-drive";

/** What a sheet's Cancel and OK do. */
interface SheetActions<Value> {
  onDone: (value: Value) => void;
  onCancel: () => void;
}

function Buttons({
  ok = "OK",
  valid,
  onOk,
  onCancel,
}: {
  ok?: string;
  valid: boolean;
  onOk: () => void;
  onCancel: () => void;
}) {
  return (
    <div className="mac-preview-app-sheet-buttons">
      <PushButton keyEquivalent="escape" onClick={onCancel}>
        Cancel
      </PushButton>
      <DefaultButton disabled={!valid} onClick={onOk}>
        {ok}
      </DefaultButton>
    </div>
  );
}

/** File > Rename…: the file's new name on the drive. */
export function RenameSheet({ name, onDone, onCancel }: SheetActions<string> & { name: string }) {
  const [value, setValue] = useState(name);
  const next = value.trim();
  const valid = next !== "" && next !== name && !next.includes("/");
  return (
    <div className="mac-preview-app-sheet">
      <SheetTitle>Rename “{name}”</SheetTitle>
      <TextField
        aria-label="Name"
        autoFocus
        value={value}
        onValueChange={setValue}
        onKeyDown={(event) => {
          if (event.key === "Enter" && valid) onDone(next);
        }}
      />
      <Buttons ok="Rename" valid={valid} onOk={() => onDone(next)} onCancel={onCancel} />
    </div>
  );
}

/** File > Move To…: the folder of the drive to put the file in. */
export function MoveSheet({
  name,
  folder,
  list,
  onDone,
  onCancel,
}: SheetActions<string> & {
  name: string;
  /** The folder it is in now, which is where the choice starts. */
  folder: string;
  list: () => Promise<PreviewFolder[]>;
}) {
  const [folders, setFolders] = useState<PreviewFolder[] | null>(null);
  const [chosen, setChosen] = useState(folder);
  const [failure, setFailure] = useState<string | null>(null);
  useEffect(() => {
    let live = true;
    list().then(
      (found) => {
        if (live) setFolders(found);
      },
      (error: unknown) => {
        if (live) setFailure(`The drive could not be read. ${String(error)}`);
      },
    );
    return () => {
      live = false;
    };
  }, [list]);
  return (
    <div className="mac-preview-app-sheet">
      <SheetTitle>Move “{name}”</SheetTitle>
      <div className="mac-preview-app-format">
        <Label>Where:</Label>
        {folders ? (
          <PopUpButton
            aria-label="Where"
            value={chosen}
            onValueChange={(value) => value && setChosen(String(value))}
          >
            {folders.map((entry) => (
              <PopUpButtonItem key={entry.id} value={entry.id}>
                {entry.path}
              </PopUpButtonItem>
            ))}
          </PopUpButton>
        ) : null}
      </div>
      {failure ? <Label color="secondary">{failure}</Label> : null}
      <Buttons
        ok="Move"
        valid={folders !== null && chosen !== folder}
        onOk={() => onDone(chosen)}
        onCancel={onCancel}
      />
    </div>
  );
}

/** Enter Password…: the password of a locked PDF. */
export function PasswordSheet({
  name,
  wrong,
  onDone,
  onCancel,
}: SheetActions<string> & { name: string; wrong: boolean }) {
  const [value, setValue] = useState("");
  return (
    <div className="mac-preview-app-sheet">
      <SheetTitle>“{name}” is locked with a password.</SheetTitle>
      {wrong ? <Label color="secondary">That password is not the right one.</Label> : null}
      <SecureTextField
        aria-label="Password"
        autoFocus
        value={value}
        onValueChange={setValue}
        onKeyDown={(event) => {
          if (event.key === "Enter" && value !== "") onDone(value);
        }}
      />
      <Buttons ok="Open" valid={value !== ""} onOk={() => onDone(value)} onCancel={onCancel} />
    </div>
  );
}
