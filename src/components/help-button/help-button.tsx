import { withClassName } from "../../lib/cn";
import { RoundButton, type RoundButtonProps } from "../round-button";
import "./help-button.css";

export interface HelpButtonProps extends Omit<RoundButtonProps, "size" | "children"> {
  /**
   * Accessible name. The button has no title, so it always needs one; translate it with the
   * rest of the interface.
   * @default "Help"
   */
  label?: string;
}

/**
 * A Catalina help button (NSButton with the help-button bezel style): the round button with a
 * question mark that opens help for the window it is in.
 *
 * It is a round button with a fixed glyph and a single size, so it accepts every prop of the
 * round button except `size` and `children`.
 */
export function HelpButton({ label = "Help", className, ...props }: HelpButtonProps) {
  return (
    <RoundButton
      aria-label={label}
      className={withClassName("mac-help-button", className)}
      {...props}
    >
      {/* Drawn for this library on the measured 7.5 x 11 pt ink box (2 units = 1 pt). */}
      <svg
        className="mac-help-button-glyph"
        viewBox="-1 0 16 22"
        width="8"
        height="11"
        aria-hidden="true"
        focusable="false"
      >
        <path
          d="M2.7 6C2.7 3.4 4.7 1.8 7.4 1.8c2.7 0 4.6 1.6 4.6 3.9 0 1.9-1.1 2.9-2.6 4-1.3 1-1.9 1.7-1.9 3V15"
          fill="none"
          stroke="currentColor"
          strokeWidth="3"
        />
        <circle cx="7.5" cy="20" r="2.1" fill="currentColor" />
      </svg>
    </RoundButton>
  );
}
