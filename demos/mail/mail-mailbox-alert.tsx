"use client";

import {
  Alert,
  AlertAccessory,
  AlertButtons,
  AlertClose,
  AlertInformativeText,
  AlertMessage,
  AlertPopup,
} from "macalicious/alert";
import { DefaultButton } from "macalicious/default-button";
import { TextField } from "macalicious/text-field";
import { useState } from "react";

/** What a mailbox is named: New Mailbox and Rename Mailbox. */
function NameForm({
  title,
  name: first,
  confirm,
  onName,
  onClose,
}: {
  title: string;
  name: string;
  confirm: string;
  onName: (name: string) => Promise<string | null>;
  onClose: () => void;
}) {
  const [name, setName] = useState(first);
  const [refusal, setRefusal] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const ready = name.trim() !== "" && !busy;
  const submit = async () => {
    if (!ready) return;
    setBusy(true);
    const answer = await onName(name.trim());
    setBusy(false);
    if (answer === null) onClose();
    else setRefusal(answer);
  };
  return (
    <AlertPopup>
      <AlertMessage>{title}</AlertMessage>
      {refusal ? <AlertInformativeText role="alert">{refusal}</AlertInformativeText> : null}
      <AlertAccessory>
        <TextField
          aria-label="Name"
          placeholder="Name"
          value={name}
          onValueChange={(text) => {
            setName(text);
            setRefusal(null);
          }}
          onKeyDown={(event) => {
            if (event.key !== "Enter") return;
            event.preventDefault();
            void submit();
          }}
        />
      </AlertAccessory>
      <AlertButtons>
        <AlertClose>Cancel</AlertClose>
        <DefaultButton disabled={!ready} onClick={() => void submit()}>
          {confirm}
        </DefaultButton>
      </AlertButtons>
    </AlertPopup>
  );
}

/**
 * The alert that names a mailbox. `onName` answers `null` when the name was taken up, or why it
 * was not, which the alert shows and stays open for.
 */
export function MailboxNameAlert({
  asking,
  onName,
  onClose,
}: {
  /** What is being named: `null` keeps the alert closed. */
  asking: { title: string; name: string; confirm: string } | null;
  onName: (name: string) => Promise<string | null>;
  onClose: () => void;
}) {
  return (
    <Alert open={asking !== null} onOpenChange={(open) => !open && onClose()}>
      {asking ? <NameForm {...asking} onName={onName} onClose={onClose} /> : null}
    </Alert>
  );
}
