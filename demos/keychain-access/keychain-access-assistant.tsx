import { Label } from "macalicious/label";
import { LevelIndicator } from "macalicious/level-indicator";
import { PopUpButton, PopUpButtonItem } from "macalicious/pop-up-button";
import { PushButton } from "macalicious/push-button";
import { Slider } from "macalicious/slider";
import { TextField } from "macalicious/text-field";
import { useId, useState } from "react";

/**
 * Password Assistant: passwords made in the browser with its cryptographic random numbers, and a
 * quality figure that estimates what a guesser faces from the password's length and the kinds of
 * character in it.
 */
const ALPHABETS = {
  "Letters & Numbers": "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789",
  "Numbers Only": "0123456789",
  Random:
    "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$%^&*()-_=+[]{};:,.<>/?",
} as const;

export type PasswordType = keyof typeof ALPHABETS;
export const PASSWORD_TYPES = Object.keys(ALPHABETS) as readonly PasswordType[];
export const MIN_LENGTH = 8;
export const MAX_LENGTH = 64;

/**
 * A password of `length` characters. A byte past the largest multiple of the alphabet's size is
 * thrown away, as taking it round would favour the alphabet's first characters.
 */
export function generatePassword(
  type: PasswordType,
  length: number,
  fill: (bytes: Uint8Array<ArrayBuffer>) => Uint8Array<ArrayBuffer> = (bytes) =>
    crypto.getRandomValues(bytes),
): string {
  const alphabet = ALPHABETS[type];
  const limit = 256 - (256 % alphabet.length);
  let password = "";
  while (password.length < length) {
    for (const byte of fill(new Uint8Array(length))) {
      if (byte < limit && password.length < length) password += alphabet[byte % alphabet.length];
    }
  }
  return password;
}

/** Bits a guesser faces at most: the length, times the bits of the kinds of character present. */
export function passwordBits(password: string): number {
  const size =
    (/[a-z]/.test(password) ? 26 : 0) +
    (/[A-Z]/.test(password) ? 26 : 0) +
    (/[0-9]/.test(password) ? 10 : 0) +
    (/[^a-zA-Z0-9]/.test(password) ? 32 : 0);
  return size === 0 ? 0 : Math.round(password.length * Math.log2(size));
}

/** The quality of `password`, as a line: nothing is sent anywhere to judge it. */
export function PasswordQuality({ password }: { password: string }) {
  const id = useId();
  const bits = passwordBits(password);
  return (
    <>
      <Label id={id} align="end">
        Quality:
      </Label>
      <div className="mac-keychain-access-quality">
        <LevelIndicator
          value={Math.min(100, (bits / 128) * 100)}
          aria-labelledby={id}
          style={{ flex: 1, minWidth: 80 }}
        />
        <Label textStyle="small">{`at most ${bits} bits`}</Label>
      </div>
    </>
  );
}

/** The assistant, opened under a password field: "Use" hands its suggestion to the field. */
export function PasswordAssistant({ onUse }: { onUse: (password: string) => void }) {
  const id = useId();
  const [open, setOpen] = useState(false);
  const [type, setType] = useState<PasswordType>("Random");
  const [length, setLength] = useState(20);
  const [suggestion, setSuggestion] = useState("");
  const choose = (nextType: PasswordType, nextLength: number) => {
    setType(nextType);
    setLength(nextLength);
    setSuggestion(generatePassword(nextType, nextLength));
  };
  if (!open) {
    return (
      <>
        <span />
        <PushButton
          onClick={() => {
            setOpen(true);
            choose(type, length);
          }}
        >
          Password Assistant…
        </PushButton>
      </>
    );
  }
  return (
    <>
      <Label id={`${id}type`} align="end">
        Type:
      </Label>
      <PopUpButton
        aria-labelledby={`${id}type`}
        value={type}
        onValueChange={(value) => choose(value as PasswordType, length)}
      >
        {PASSWORD_TYPES.map((each) => (
          <PopUpButtonItem key={each} value={each}>
            {each}
          </PopUpButtonItem>
        ))}
      </PopUpButton>
      <Label id={`${id}suggestion`} align="end">
        Suggestion:
      </Label>
      <TextField aria-labelledby={`${id}suggestion`} readOnly value={suggestion} />
      <Label id={`${id}length`} align="end">
        Length: {length}
      </Label>
      <Slider
        aria-labelledby={`${id}length`}
        min={MIN_LENGTH}
        max={MAX_LENGTH}
        value={length}
        onValueChange={(value) => choose(type, value as number)}
      />
      <PasswordQuality password={suggestion} />
      <span />
      <div className="mac-keychain-access-quality">
        <PushButton onClick={() => setSuggestion(generatePassword(type, length))}>
          Another
        </PushButton>
        <PushButton
          onClick={() => {
            onUse(suggestion);
            setOpen(false);
          }}
        >
          Use This Password
        </PushButton>
      </div>
    </>
  );
}
