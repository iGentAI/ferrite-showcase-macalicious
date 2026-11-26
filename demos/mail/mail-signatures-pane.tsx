"use client";

import { BorderedList, BorderedListRow, BorderedListRows } from "macalicious/bordered-list";
import { Checkbox } from "macalicious/checkbox";
import { GradientButton } from "macalicious/gradient-button";
import { Label } from "macalicious/label";
import { MenuSeparator } from "macalicious/menu-item";
import { PopUpButton, PopUpButtonItem } from "macalicious/pop-up-button";
import { TextField } from "macalicious/text-field";
import { TextView } from "macalicious/text-view";
import { useState } from "react";
import {
  type MailSignature,
  type MailSignatures,
  NO_SIGNATURE,
  RANDOM_SIGNATURE,
  SEQUENTIAL_SIGNATURE,
} from "./mail-signatures";

/** Preferences > Signatures: the list with + and −, each one's name and text, and which is used. */
export function MailSignaturesPane({
  kept,
  above,
  font,
  onChange,
  onAboveChange,
}: {
  kept: MailSignatures;
  /** Place signature above quoted text. */
  above: boolean;
  /** The message font of Fonts & Colors, as its name and size. */
  font: string;
  onChange: (kept: MailSignatures) => void;
  onAboveChange: (above: boolean) => void;
}) {
  const [picked, setPicked] = useState<readonly string[]>(() =>
    kept.list[0] ? [kept.list[0].id] : [],
  );
  const current = kept.list.find((signature) => signature.id === picked[0]) ?? null;
  const change = (id: string, next: Partial<MailSignature>) =>
    onChange({
      ...kept,
      list: kept.list.map((signature) =>
        signature.id === id ? { ...signature, ...next } : signature,
      ),
    });
  const add = () => {
    const made: MailSignature = {
      id: `signature-${crypto.randomUUID()}`,
      name: `Signature #${kept.list.length + 1}`,
      text: "",
    };
    onChange({ ...kept, list: [...kept.list, made] });
    setPicked([made.id]);
  };
  const remove = () => {
    if (!current) return;
    const list = kept.list.filter((signature) => signature.id !== current.id);
    onChange({ ...kept, list, chosen: kept.chosen === current.id ? NO_SIGNATURE : kept.chosen });
    setPicked(list[0] ? [list[0].id] : []);
  };
  return (
    <div className="mac-mail-signatures">
      <div className="mac-mail-signatures-editor">
        <BorderedList
          className="mac-mail-signatures-list"
          footerLabel="Edit signatures"
          footer={
            <>
              <GradientButton glyph="add" aria-label="Add Signature" onClick={add} />
              <GradientButton
                glyph="remove"
                aria-label="Remove Signature"
                disabled={!current}
                onClick={remove}
              />
            </>
          }
        >
          <BorderedListRows aria-label="Signatures" value={picked} onValueChange={setPicked}>
            {kept.list.map((signature) => (
              <BorderedListRow
                key={signature.id}
                value={signature.id}
                title={signature.name || "Untitled"}
              />
            ))}
          </BorderedListRows>
        </BorderedList>
        <div className="mac-mail-signatures-text">
          <TextField
            aria-label="Signature Name"
            placeholder="Signature Name"
            disabled={!current}
            value={current?.name ?? ""}
            onValueChange={(name) => current && change(current.id, { name })}
          />
          <div className="mac-mail-signatures-frame">
            <TextView
              aria-label="Signature Text"
              disabled={!current}
              value={current?.text ?? ""}
              onValueChange={(text) => current && change(current.id, { text })}
            />
          </div>
        </div>
      </div>
      <Checkbox
        checked
        disabled
        title="A signature here is plain text, so it always has the message's font."
      >
        Always match my default message font ({font})
      </Checkbox>
      <div className="mac-mail-smart-line">
        <Label>Choose Signature:</Label>
        <PopUpButton
          aria-label="Choose Signature"
          value={kept.chosen}
          onValueChange={(chosen) => onChange({ ...kept, chosen: String(chosen) })}
        >
          <PopUpButtonItem value={NO_SIGNATURE}>None</PopUpButtonItem>
          {kept.list.length > 0 ? <MenuSeparator /> : null}
          {kept.list.map((signature) => (
            <PopUpButtonItem key={signature.id} value={signature.id}>
              {signature.name || "Untitled"}
            </PopUpButtonItem>
          ))}
          {kept.list.length > 0 ? <MenuSeparator /> : null}
          {kept.list.length > 0 ? (
            <PopUpButtonItem value={RANDOM_SIGNATURE}>At Random</PopUpButtonItem>
          ) : null}
          {kept.list.length > 0 ? (
            <PopUpButtonItem value={SEQUENTIAL_SIGNATURE}>In Sequential Order</PopUpButtonItem>
          ) : null}
        </PopUpButton>
      </div>
      <Checkbox checked={above} onCheckedChange={(checked) => onAboveChange(checked === true)}>
        Place signature above quoted text
      </Checkbox>
    </div>
  );
}
