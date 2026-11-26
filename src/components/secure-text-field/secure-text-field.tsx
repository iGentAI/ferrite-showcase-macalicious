"use client";

import { type KeyboardEvent, useState } from "react";
import { cn } from "../../lib/cn";
import { TextField, type TextFieldProps } from "../text-field";
import "./secure-text-field.css";

export interface SecureTextFieldProps extends Omit<TextFieldProps, "type" | "children"> {
  /**
   * What the field shows for each typed character: a bullet, or nothing at all
   * (`NSSecureTextFieldCell.echosBullets` switched off). With `"none"` the text stays
   * invisible; the insertion point still moves.
   * @default "bullets"
   */
  echo?: "bullets" | "none";
  /**
   * Accessible name of the Caps Lock indicator, which appears at the trailing edge while the
   * field has the keyboard and Caps Lock is on.
   * @default "Caps Lock is on"
   */
  capsLockLabel?: string;
}

/**
 * A Catalina secure text field (NSSecureTextField): a text field for a password, which shows a
 * bullet for every character and warns when Caps Lock is on.
 *
 * It is a `TextField` whose input has `type="password"`, and takes the same props.
 */
export function SecureTextField({
  echo = "bullets",
  capsLockLabel = "Caps Lock is on",
  className,
  onKeyDown,
  onKeyUp,
  onBlur,
  ...props
}: SecureTextFieldProps) {
  const [capsLock, setCapsLock] = useState(false);
  const readCapsLock = (event: KeyboardEvent<HTMLInputElement>) => {
    // Synthetic keyboard events from some input methods carry no modifier state.
    setCapsLock(event.getModifierState?.("CapsLock") ?? false);
  };

  return (
    <TextField
      {...props}
      type="password"
      data-echo={echo}
      className={cn("mac-secure-text-field", className)}
      onKeyDown={(event) => {
        onKeyDown?.(event);
        readCapsLock(event);
      }}
      onKeyUp={(event) => {
        onKeyUp?.(event);
        readCapsLock(event);
      }}
      onBlur={(event) => {
        onBlur?.(event);
        setCapsLock(false);
      }}
    >
      {capsLock && (
        <svg
          className="mac-secure-text-field-caps-lock"
          viewBox="0 0 13 13"
          role="img"
          aria-label={capsLockLabel}
        >
          <rect x="0.5" y="0.5" width="12" height="12" rx="2.5" />
          <path d="M6.5 2.8 10 6.6H8.1V10H4.9V6.6H3z" />
        </svg>
      )}
    </TextField>
  );
}
