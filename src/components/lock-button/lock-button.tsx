import { Button as BaseButton } from "@base-ui/react/button";
import type { ReactNode, Ref } from "react";
import { withClassName } from "../../lib/cn";
import "./lock-button.tokens.css";
import "./lock-button.css";

export interface LockButtonProps extends Omit<BaseButton.Props, "ref" | "children"> {
  /**
   * Authorization state (SFAuthorizationView): `locked` draws the closed lock, `unlocked` the
   * open one, and `authenticating` is the time in between, while the application asks for a
   * password. The application owns the state and changes it in response to `onClick`.
   * @default "locked"
   */
  state?: "locked" | "authenticating" | "unlocked";
  /**
   * `regular` is the lock with its status text in the footer of a preference pane. `small` is
   * the 13 pt lock alone, as in the corner of a Finder Info window; its text is kept for
   * assistive technology.
   * @default "regular"
   */
  size?: "regular" | "small";
  /**
   * Status text. The default follows the state: "Click the lock to make changes.",
   * "Authenticating…" or "Click the lock to prevent further changes."
   */
  children?: ReactNode;
  /** Ref to the rendered element. */
  ref?: Ref<HTMLElement>;
}

const statusText = {
  locked: "Click the lock to make changes.",
  authenticating: "Authenticating…",
  unlocked: "Click the lock to prevent further changes.",
} as const;

/* The padlock is drawn for this library, not copied from macOS: a gold body with seven ridges
   and a steel shackle on the measured 22 x 27.5 pt box, in the measured palette, which lives in
   lock-button.tokens.css. It is the same
   in Aqua and Dark Aqua, as in Catalina. The right leg of the shackle is longer than the left,
   so that it stays in the body when CSS raises the shackle for the unlocked state. The small
   size is the measured 13 x 16 pt, a touch flatter than the large one, so the drawing is
   stretched to its box instead of keeping its proportions. */
const padlock = (
  <svg
    className="mac-lock-button-icon"
    viewBox="0 0 22 27.5"
    width="22"
    height="27.5"
    preserveAspectRatio="none"
    aria-hidden="true"
    focusable="false"
  >
    <g className="mac-lock-button-shackle" fill="none">
      <path
        d="M4 12.5v-4a7 7 0 0 1 14 0v8.5"
        stroke="var(--mac-lock-button-shackle-edge)"
        strokeWidth="3"
      />
      <path
        d="M4 12.5v-4a7 7 0 0 1 14 0v8.5"
        stroke="var(--mac-lock-button-shackle)"
        strokeWidth="2"
      />
      <path
        d="M4.2 8.3a6.8 6.8 0 0 1 13.6 0"
        stroke="var(--mac-lock-button-shackle-highlight)"
        strokeWidth="1.1"
      />
      <path
        d="M5.4 8.6a5.6 5.6 0 0 1 11.2 0"
        stroke="var(--mac-lock-button-shackle-shade)"
        strokeWidth="0.5"
      />
    </g>
    <path d="M.5 11.25h21v16H.5z" fill="var(--mac-lock-button-body)" />
    <path
      d="M.5 12h21v.8H.5zm0 2.2h21v.9H.5zm0 2.3h21v.9H.5zm0 2.2h21v.9H.5zm0 2.3h21v.9H.5zm0 2.2h21v.9H.5zm0 2.3h21v.8H.5z"
      fill="var(--mac-lock-button-ridge-light)"
    />
    <path
      d="M.5 13.2h21v.7H.5zm0 2.3h21v.5H.5zm0 2.2h21v.7H.5zm0 2.3h21v.5H.5zm0 2.2h21v.7H.5zm0 2.3h21v.5H.5z"
      fill="var(--mac-lock-button-ridge-dark)"
    />
    <path d="M.5 11.25h21v.5H.5z" fill="var(--mac-lock-button-body-top)" />
    <path d="M.25 11.25h.5v16h-.5zm21 0h.5v16h-.5z" fill="var(--mac-lock-button-body-side)" />
    <path d="M.25 26.75h21.5v.5H.25z" fill="var(--mac-lock-button-body-bottom)" />
  </svg>
);

/**
 * The Catalina authorization lock (SFAuthorizationView): a padlock and a line of status text at
 * the foot of a preference pane, which guards settings that need an administrator.
 *
 * Built on Base UI's Button. The component only shows the state it is given: on `onClick`, ask
 * for the password yourself (a sheet or a dialog) and set `state`. `aria-pressed` reports the
 * unlocked state and the status text is the accessible name.
 */
export function LockButton({
  state = "locked",
  size = "regular",
  className,
  children,
  ...props
}: LockButtonProps) {
  return (
    <BaseButton
      aria-pressed={state === "unlocked"}
      aria-busy={state === "authenticating" ? true : undefined}
      data-state={state}
      data-size={size}
      className={withClassName("mac-lock-button", className)}
      {...props}
    >
      {padlock}
      <span className="mac-lock-button-text">{children ?? statusText[state]}</span>
    </BaseButton>
  );
}
