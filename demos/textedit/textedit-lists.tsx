"use client";

import { DefaultButton } from "macalicious/default-button";
import { PopUpButton, PopUpButtonItem } from "macalicious/pop-up-button";
import { PushButton } from "macalicious/push-button";
import { SavePanelRow } from "macalicious/save-panel";
import { SheetActions, SheetTitle } from "macalicious/sheet";
import { TextField } from "macalicious/text-field";
import { useId, useState } from "react";
import { COUNTED_LISTS, LISTS } from "./textedit-data";

/** The list a selection is given: its style, and where a counted one starts. */
export interface TextEditListChoice {
  style: string;
  start: number;
}

const MOST_START = 999_999;

/** Format > Lists…: the list style of the selection's paragraphs, and the number it starts at. */
export function TextEditLists({
  value,
  onChoose,
  onCancel,
}: {
  value: TextEditListChoice;
  onChoose: (choice: TextEditListChoice) => void;
  onCancel: () => void;
}) {
  const [style, setStyle] = useState(value.style);
  const [start, setStart] = useState(String(value.start));
  const styleField = useId();
  const startField = useId();
  const counted = COUNTED_LISTS.has(style);
  const number = Number(start);
  const valid = !counted || (/^\d+$/.test(start) && number <= MOST_START);
  return (
    <form
      className="mac-textedit-rename"
      onSubmit={(event) => {
        event.preventDefault();
        if (valid) onChoose({ style, start: counted ? number : 1 });
      }}
    >
      <SheetTitle>List</SheetTitle>
      <div className="mac-save-panel-form">
        <SavePanelRow label="Bullets & Numbering:" labelFor={styleField}>
          <PopUpButton
            id={styleField}
            value={style}
            onValueChange={(next) => setStyle(next as string)}
            style={{ width: 160 }}
          >
            {LISTS.map((list) => (
              <PopUpButtonItem key={list.value} value={list.value}>
                {list.label}
              </PopUpButtonItem>
            ))}
          </PopUpButton>
        </SavePanelRow>
        <SavePanelRow label="Start at:" labelFor={startField}>
          <TextField
            id={startField}
            disabled={!counted}
            value={counted ? start : ""}
            onValueChange={setStart}
            style={{ width: 64 }}
          />
        </SavePanelRow>
      </div>
      <SheetActions>
        <PushButton type="button" onClick={onCancel}>
          Cancel
        </PushButton>
        <DefaultButton type="submit" disabled={!valid}>
          OK
        </DefaultButton>
      </SheetActions>
    </form>
  );
}
