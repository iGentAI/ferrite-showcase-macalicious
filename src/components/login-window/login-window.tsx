"use client";

import { Button as BaseButton } from "@base-ui/react/button";
import { Field as BaseField } from "@base-ui/react/field";
import { Input as BaseInput } from "@base-ui/react/input";
import {
  type ComponentProps,
  type FormEvent,
  type KeyboardEvent,
  type ReactNode,
  type Ref,
  useEffect,
  useId,
  useRef,
} from "react";
import { cn, withClassName } from "../../lib/cn";
import { useControlled } from "../../lib/use-controlled";
import { ProgressSpinner } from "../progress-spinner";
import "./login-window.tokens.css";
import "./login-window.css";

/** One account on a `LoginWindow`. */
export interface LoginWindowUser {
  /** What identifies the account: the value the selection holds. Unique in the list. */
  value: string;
  /** The name under the picture. */
  name: string;
  /** The account picture, clipped to a 93 pt circle; a neutral silhouette if left out. Decorative. */
  picture?: ReactNode;
}

// Glyphs of the round buttons, drawn for this library in the 30 pt box of the ring.
const GLYPHS = {
  cancel: "M9.75 9.75l10.5 10.5m0-10.5-10.5 10.5",
  sleep: "M19.4 17.9A6.6 6.6 0 0 1 12.1 9.7a6.6 6.6 0 1 0 7.3 8.2z",
  restart: "M18.8 9.6v10.8L10.2 15z",
  "shut-down": "M15 8.4v6.2m-3.7-3.9a5.9 5.9 0 1 0 7.4 0",
};

export interface LoginWindowProps extends Omit<ComponentProps<"div">, "onSubmit" | "defaultValue"> {
  /** The accounts. One is asked for its password at once; several are listed to choose from. */
  users: LoginWindowUser[];
  /** The `value` of the account whose password is asked, controlled; `null` shows the list. */
  value?: string | null;
  /** The account asked at first, when the window keeps its own: the only one, or none (`null`). */
  defaultValue?: string | null;
  /** Called with an account's `value` when it is chosen, and with `null` when Escape returns to the list. */
  onValueChange?: (value: string | null) => void;
  /** Called with the typed password and the account's `value` by Return and by the arrow in the field. */
  onSubmit?: (password: string, user: string) => void;
  /** Called by Escape, when there is no list of accounts to return to. */
  onCancel?: () => void;
  /**
   * The password was rejected: the field shakes once and is emptied. Set it back to `false`
   * when the next password is submitted, so that another rejection shakes again.
   * @default false
   */
  invalid?: boolean;
  /**
   * The password is being checked: a spinner takes the arrow's place and the field cannot be
   * edited.
   * @default false
   */
  busy?: boolean;
  /** Text under the field: the password hint, or a status message. It describes the field. */
  hint?: ReactNode;
  /**
   * Text of the empty field; it is also the field's accessible name.
   * @default "Enter Password"
   */
  placeholder?: string;
  /**
   * Accessible name of the arrow button in the field.
   * @default "Log In"
   */
  submitLabel?: string;
  /**
   * Accessible name of the spinner shown while `busy`.
   * @default "Checking password"
   */
  busyLabel?: string;
  /**
   * Accessible name of the list of accounts.
   * @default "Users"
   */
  usersLabel?: string;
  /** The row of round buttons at the bottom: `LoginWindowButton`s. */
  actions?: ReactNode;
  /** Ref to the password `<input>`, to focus it. */
  inputRef?: Ref<HTMLInputElement>;
}

/**
 * The login window: a user's picture and name over the desktop picture with a translucent
 * password field under them, a row of round buttons at the bottom and, as its children, the
 * status items at the top right. With several users it first lists them.
 *
 * Nothing is authenticated here: `onSubmit` hands over what was typed and `invalid`, `busy`
 * and `hint` show the answer. The window is always light on dark, so the root carries
 * `data-appearance="dark"`; it fills its container, and `className`, `style` (a `background`
 * for the picture), `ref` and other attributes go to it.
 */
export function LoginWindow({
  users,
  value,
  defaultValue,
  onValueChange,
  onSubmit,
  onCancel,
  invalid = false,
  busy = false,
  hint,
  placeholder = "Enter Password",
  submitLabel = "Log In",
  busyLabel = "Checking password",
  usersLabel = "Users",
  actions,
  inputRef,
  className,
  children,
  onKeyDown,
  ...props
}: LoginWindowProps) {
  const nameId = useId();
  const form = useRef<HTMLFormElement>(null);
  // The account chosen from the list, to move the keyboard along with the change.
  const chosen = useRef<string | null>(null);
  const only = users.length === 1 ? users[0] : undefined;
  const [selected, setSelected] = useControlled(
    value,
    defaultValue === undefined ? (only?.value ?? null) : defaultValue,
    onValueChange,
  );
  const user = users.find((candidate) => candidate.value === selected);

  // A rejected password is thrown away, as the login window does.
  useEffect(() => {
    if (invalid) form.current?.reset();
  }, [invalid]);

  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    // The keyboard stays in the field: the arrow goes while the password is checked, and
    // with a rejected one.
    event.currentTarget.querySelector("input")?.focus();
    if (user && !busy) {
      onSubmit?.(String(new FormData(event.currentTarget).get("password") ?? ""), user.value);
    }
  };

  const onListKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    const step = event.key === "ArrowRight" ? 1 : event.key === "ArrowLeft" ? -1 : 0;
    const buttons = Array.from(event.currentTarget.querySelectorAll("button"));
    const next = buttons[buttons.indexOf(event.target as HTMLButtonElement) + step];
    if (step && next) {
      event.preventDefault();
      next.focus();
    }
  };

  const picture = (of: LoginWindowUser) => (
    <span className="mac-login-window-picture" aria-hidden="true">
      {of.picture ?? (
        <svg viewBox="0 0 93 93" width="93" height="93" aria-hidden="true">
          <circle cx="46.5" cy="37" r="17" />
          <path d="M12 93c1-21 14-31 34.5-31S80 72 81 93z" />
        </svg>
      )}
    </span>
  );

  return (
    // biome-ignore lint/a11y/noStaticElementInteractions: Escape pressed in the field or on a button inside bubbles to here
    <div
      data-appearance="dark"
      className={cn("mac-login-window", className)}
      onKeyDown={(event) => {
        onKeyDown?.(event);
        if (event.key !== "Escape" || event.defaultPrevented) return;
        if (user && !only) {
          chosen.current = user.value;
          setSelected(null);
        } else onCancel?.();
      }}
      {...props}
    >
      {children != null && <div className="mac-login-window-status">{children}</div>}
      {user ? (
        // Another account is another form: what was typed for one is never sent for another.
        <form
          key={user.value}
          ref={form}
          aria-labelledby={nameId}
          className="mac-login-window-prompt"
          onSubmit={submit}
        >
          <div className="mac-login-window-user">
            {picture(user)}
            <span id={nameId} className="mac-login-window-name">
              {user.name}
            </span>
          </div>
          <BaseField.Root invalid={invalid} className="mac-login-window-field">
            <BaseInput
              ref={inputRef}
              type="password"
              name="password"
              aria-label={placeholder}
              placeholder={placeholder}
              autoComplete="current-password"
              readOnly={busy}
              autoFocus={chosen.current !== null}
              className="mac-login-window-input"
            />
            {busy ? (
              <ProgressSpinner
                size="small"
                aria-label={busyLabel}
                className="mac-login-window-busy"
              />
            ) : (
              <BaseButton
                type="submit"
                aria-label={submitLabel}
                className="mac-login-window-submit"
              >
                <svg viewBox="0 0 18 18" width="18" height="18" aria-hidden="true">
                  <circle cx="9" cy="9" r="8.25" />
                  <path d="M5 9h8M9.8 5.8 13 9l-3.2 3.2" />
                </svg>
              </BaseButton>
            )}
            {hint != null && (
              <BaseField.Description className="mac-login-window-hint">
                {hint}
              </BaseField.Description>
            )}
          </BaseField.Root>
        </form>
      ) : (
        // biome-ignore lint/a11y/useSemanticElements: a fieldset would bring a legend and its own layout
        <div
          role="group"
          aria-label={usersLabel}
          className="mac-login-window-users"
          onKeyDown={onListKeyDown}
        >
          {users.map((candidate) => (
            <BaseButton
              key={candidate.value}
              // Escape came back from this user's password field, which is gone.
              autoFocus={candidate.value === chosen.current}
              className="mac-login-window-user"
              onClick={() => {
                chosen.current = candidate.value;
                setSelected(candidate.value);
              }}
            >
              {picture(candidate)}
              <span className="mac-login-window-name">{candidate.name}</span>
            </BaseButton>
          ))}
        </div>
      )}
      {actions != null && <div className="mac-login-window-actions">{actions}</div>}
    </div>
  );
}

export interface LoginWindowButtonProps extends Omit<BaseButton.Props, "ref"> {
  /**
   * The glyph in the ring: a cross, a crescent, a triangle or a power symbol.
   * @default "cancel"
   */
  glyph?: "cancel" | "sleep" | "restart" | "shut-down";
  /** Ref to the rendered element. */
  ref?: Ref<HTMLElement>;
}

/**
 * A round button of the login window: a glyph in a 30 pt ring on a translucent disc, with its
 * title, the children, under it. Cancel, Sleep, Restart and Shut Down are these.
 *
 * Built on Base UI's Button, so it also accepts `disabled`, `render` and every native button
 * attribute.
 */
export function LoginWindowButton({
  glyph = "cancel",
  className,
  children,
  ...props
}: LoginWindowButtonProps) {
  return (
    <BaseButton
      data-glyph={glyph}
      className={withClassName("mac-login-window-button", className)}
      {...props}
    >
      <span className="mac-login-window-disc">
        <svg viewBox="0 0 30 30" width="30" height="30" aria-hidden="true">
          <circle cx="15" cy="15" r="14.25" />
          <path d={GLYPHS[glyph]} />
        </svg>
      </span>
      {children}
    </BaseButton>
  );
}
