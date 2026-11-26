"use client";

import { MenuCheckboxItem } from "macalicious/menu-item";
import type { ProgrammerAction } from "./calculator-bits";
import type { CalculatorAction } from "./calculator-engine";
import type { StackAction } from "./calculator-rpn";

const SPEECH_REASON = "This browser has no voice to speak with.";

const canSpeak = () =>
  typeof speechSynthesis !== "undefined" && typeof SpeechSynthesisUtterance !== "undefined";

/** Says a key: a new key cuts off the one before it, as keys come faster than they can be said. */
export function speakKey(text: string) {
  if (!canSpeak()) return;
  speechSynthesis.cancel();
  speechSynthesis.speak(new SpeechSynthesisUtterance(text));
}

/** Says a result, after whatever is being said. */
export function speakResult(text: string) {
  if (canSpeak()) speechSynthesis.speak(new SpeechSynthesisUtterance(text));
}

const OPERATOR_WORDS: Record<string, string> = {
  add: "Add",
  subtract: "Subtract",
  multiply: "Multiply",
  divide: "Divide",
  power: "To the power",
  and: "And",
  or: "Or",
  nor: "Nor",
  xor: "Exclusive or",
};

/** The word for a key typed on the keyboard, the same as the name of the key on the keypad. */
export function spokenKey(
  action: CalculatorAction | ProgrammerAction | StackAction,
): string | null {
  switch (action.type) {
    case "digit":
      return action.digit;
    case "digits":
      return action.digits;
    case "operator":
      return OPERATOR_WORDS[action.operator] ?? null;
    case "equals":
      return "Equals";
    case "decimal":
      return "Decimal point";
    case "percent":
      return "Percent";
    case "negate":
      return "Negate";
    case "clear":
      return "Clear";
    case "delete":
      return "Delete";
    default:
      return null;
  }
}

export interface CalculatorSpeechItemsProps {
  speakButtons: boolean;
  speakResults: boolean;
  commands: () => {
    setSpeakButtons: (on: boolean) => void;
    setSpeakResults: (on: boolean) => void;
  };
}

/** Calculator's Speech menu, in the browser's own voice; dimmed where it has none. */
export function CalculatorSpeechItems({
  speakButtons,
  speakResults,
  commands,
}: CalculatorSpeechItemsProps) {
  const usable = canSpeak();
  const why = usable ? undefined : SPEECH_REASON;
  return (
    <>
      <MenuCheckboxItem
        checked={speakButtons}
        disabled={!usable}
        title={why}
        onCheckedChange={(on) => commands().setSpeakButtons(on)}
      >
        Speaking Button Pressed
      </MenuCheckboxItem>
      <MenuCheckboxItem
        checked={speakResults}
        disabled={!usable}
        title={why}
        onCheckedChange={(on) => commands().setSpeakResults(on)}
      >
        Speak Result
      </MenuCheckboxItem>
    </>
  );
}
