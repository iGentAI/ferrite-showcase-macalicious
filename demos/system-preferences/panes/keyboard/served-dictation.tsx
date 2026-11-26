"use client";

import { Label } from "macalicious/label";
import { PopUpButton, PopUpButtonItem } from "macalicious/pop-up-button";
import { RadioButton, RadioGroup } from "macalicious/radio-button";
import { offerDictation } from "../../../desktop/desktop-dictation";
import { PaneAt, PaneForm } from "../../form";
import { usePreference } from "../../pane";
import {
  DICTATION_LANGUAGE,
  DICTATION_LANGUAGES,
  DICTATION_ON,
  SAME_AS_BROWSER,
} from "./dictation-settings";

/** The tab view's top-left corner in the window frame, as `keyboard.tsx` places it. */
const TABS = { x: 20, y: 63 };

const NO_RECOGNITION =
  "This browser offers web pages no speech recognition, so nothing can be dictated.";
const COMPUTER_KEEPS_FN =
  "A page cannot see the Fn key. Choose Edit > Start Dictation in the menu bar.";

/**
 * The Dictation tab on the served desktop: On or Off and the language reach Edit > Start Dictation
 * (`desktop-dictation.tsx`). The browser's recognizer does the hearing, so what it may do is the
 * browser's to say.
 */
export function ServedDictation() {
  const hears = "SpeechRecognition" in window || "webkitSpeechRecognition" in window;
  const [on, setOn] = usePreference<boolean>(DICTATION_ON, false);
  const [language, setLanguage] = usePreference<string>(DICTATION_LANGUAGE, SAME_AS_BROWSER);
  return (
    <PaneForm origin={TABS}>
      <PaneAt x={82.5} y={113}>
        <Label id="keyboard-dictation">Dictation:</Label>
      </PaneAt>
      <PaneAt x={190} y={113}>
        <RadioGroup
          aria-labelledby="keyboard-dictation"
          orientation="horizontal"
          value={on && hears ? "on" : "off"}
          onValueChange={(value) => (value === "on" ? offerDictation() : setOn(false))}
          disabled={!hears}
          title={hears ? undefined : NO_RECOGNITION}
          style={{ gap: 12 }}
        >
          <RadioButton value="on">On</RadioButton>
          <RadioButton value="off">Off</RadioButton>
        </RadioGroup>
      </PaneAt>
      <PaneAt x={82.5} y={146}>
        <Label id="keyboard-dictation-language">Language:</Label>
      </PaneAt>
      <PaneAt x={190} y={143}>
        <PopUpButton
          aria-labelledby="keyboard-dictation-language"
          value={language}
          onValueChange={(next) => setLanguage(String(next))}
          disabled={!hears || !on}
          title={hears ? undefined : NO_RECOGNITION}
          style={{ width: 240 }}
        >
          {DICTATION_LANGUAGES.map((each) => (
            <PopUpButtonItem key={each} value={each}>
              {each}
            </PopUpButtonItem>
          ))}
        </PopUpButton>
      </PaneAt>
      <PaneAt x={82.5} y={177}>
        <Label id="keyboard-dictation-shortcut">Shortcut:</Label>
      </PaneAt>
      <PaneAt x={190} y={174}>
        <PopUpButton
          aria-labelledby="keyboard-dictation-shortcut"
          value="Edit menu"
          disabled
          title={COMPUTER_KEEPS_FN}
          style={{ width: 240 }}
        >
          <PopUpButtonItem value="Edit menu">Edit menu</PopUpButtonItem>
        </PopUpButton>
      </PaneAt>
      <PaneAt x={82.5} y={214} width={500}>
        <Label>
          {`Edit > Start Dictation types what this browser's speech recognition hears at the insertion point. This browser ${hears ? "offers" : "does not offer"} speech recognition to web pages, and some browsers send what they hear to their maker. ${COMPUTER_KEEPS_FN}`}
        </Label>
      </PaneAt>
    </PaneForm>
  );
}
