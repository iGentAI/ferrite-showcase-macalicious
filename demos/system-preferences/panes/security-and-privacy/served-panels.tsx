"use client";

import { Checkbox } from "macalicious/checkbox";
import { DefaultButton } from "macalicious/default-button";
import { Label } from "macalicious/label";
import { PushButton } from "macalicious/push-button";
import { SheetActions } from "macalicious/sheet";
import { TextField } from "macalicious/text-field";
import { useState } from "react";
import { usePreference } from "../../pane";
import { PaneSheet } from "../../pane-sheet";
import {
  LOCK_MESSAGE_KEY,
  LOG_OUT_MINUTES,
  LOG_OUT_MINUTES_KEY,
  LOG_OUT_ON_KEY,
} from "./served-security";
import "./security-and-privacy.css";

const MOST_MINUTES = 960;
const NO_ADMINISTRATOR =
  "This desktop has no administrators, and a web page cannot ask for your computer's.";

/** Set Lock Message…: the words the lock screen shows under the password. */
export function LockMessagePanel({ frame, onClose }: { frame: Element; onClose: () => void }) {
  const [saved, setSaved] = usePreference(LOCK_MESSAGE_KEY, "");
  const [words, setWords] = useState(saved);
  return (
    <PaneSheet frame={frame} title="Set Lock Message" onClose={onClose}>
      <div className="mac-system-preferences-security-panel">
        <Label>Show this message when the screen is locked:</Label>
        <TextField
          aria-label="Lock message"
          value={words}
          maxLength={200}
          onChange={(event) => setWords(event.currentTarget.value)}
          style={{ width: "100%" }}
        />
      </div>
      <SheetActions>
        <PushButton onClick={onClose}>Cancel</PushButton>
        <DefaultButton
          onClick={() => {
            setSaved(words);
            onClose();
          }}
        >
          OK
        </DefaultButton>
      </SheetActions>
    </PaneSheet>
  );
}

/** Advanced…: logging out after a time with no input on this page. */
export function AdvancedPanel({ frame, onClose }: { frame: Element; onClose: () => void }) {
  const [on, setOn] = usePreference(LOG_OUT_ON_KEY, false);
  const [minutes, setMinutes] = usePreference(LOG_OUT_MINUTES_KEY, LOG_OUT_MINUTES);
  const [typed, setTyped] = useState(String(minutes));
  return (
    <PaneSheet frame={frame} title="Advanced" onClose={onClose}>
      <div className="mac-system-preferences-security-panel">
        <div className="mac-system-preferences-security-panel-row">
          <Checkbox checked={on} onCheckedChange={setOn}>
            Log out after
          </Checkbox>
          <TextField
            aria-label="Minutes of inactivity"
            inputMode="numeric"
            value={typed}
            disabled={!on}
            onChange={(event) => {
              const next = event.currentTarget.value;
              setTyped(next);
              const number = Number(next);
              if (Number.isInteger(number) && number >= 1 && number <= MOST_MINUTES)
                setMinutes(number);
            }}
            style={{ width: 52 }}
          />
          <Label>minutes of inactivity</Label>
        </div>
        <Label textStyle="small">
          A web page sees only its own input, so this counts from your last input on this desktop's
          page. It logs you out of this desktop, not your computer.
        </Label>
        <Checkbox disabled title={NO_ADMINISTRATOR}>
          Require an administrator password to access system-wide preferences
        </Checkbox>
      </div>
      <SheetActions>
        <DefaultButton onClick={onClose}>OK</DefaultButton>
      </SheetActions>
    </PaneSheet>
  );
}
