"use client";

import { ComboBox, ComboBoxItem } from "macalicious/combo-box";
import { DefaultButton } from "macalicious/default-button";
import { PushButton } from "macalicious/push-button";
import {
  Sheet,
  SheetActions,
  SheetClose,
  SheetDescription,
  SheetPopup,
  SheetTitle,
} from "macalicious/sheet";
import { useState } from "react";
import { LIMITS } from "./tv-youtube-data";

/** Get Info of one video: what it is, and its Genre, one of `choices` or anything typed. */
export function TvInfoSheet({
  anchor,
  title,
  kind,
  genre,
  choices,
  refusal,
  onSave,
  onCancel,
}: {
  anchor: Element | null;
  title: string;
  kind: string;
  genre: string;
  choices: readonly string[];
  /** Why this text cannot be kept, or `undefined` when it can. */
  refusal: (genre: string) => string | undefined;
  onSave: (genre: string) => void;
  onCancel: () => void;
}) {
  const [text, setText] = useState(genre);
  const refused = refusal(text);
  return (
    <Sheet
      open
      onOpenChange={(open) => {
        if (!open) onCancel();
      }}
    >
      <SheetPopup anchor={anchor} width={400} aria-label="Get Info">
        <form
          onSubmit={(event) => {
            event.preventDefault();
            if (!refused) onSave(text);
          }}
        >
          <SheetTitle>{title}</SheetTitle>
          <SheetDescription>{kind}</SheetDescription>
          <div className="mac-tv-info-row">
            <label htmlFor="mac-tv-info-genre">Genre:</label>
            <ComboBox
              id="mac-tv-info-genre"
              autoFocus
              maxLength={LIMITS.genre}
              value={text}
              onValueChange={(value) => setText(value)}
              style={{ width: "100%" }}
            >
              {choices.map((choice) => (
                <ComboBoxItem key={choice}>{choice}</ComboBoxItem>
              ))}
            </ComboBox>
          </div>
          {refused ? <p role="alert">{refused}</p> : null}
          <SheetActions>
            <SheetClose render={<PushButton />}>Cancel</SheetClose>
            <DefaultButton type="submit" disabled={refused !== undefined}>
              OK
            </DefaultButton>
          </SheetActions>
        </form>
      </SheetPopup>
    </Sheet>
  );
}
