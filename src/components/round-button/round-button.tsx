import { Button as BaseButton } from "@base-ui/react/button";
import type { Ref } from "react";
import { withClassName } from "../../lib/cn";
import type { ControlSize } from "../../lib/control-size";
import "./round-button.tokens.css";
import "./round-button.css";

export interface RoundButtonProps extends Omit<BaseButton.Props, "ref"> {
  /**
   * AppKit control size: a 20, 17 or 14 pt circle.
   * @default "regular"
   */
  size?: ControlSize;
  /**
   * How the button is drawn. `"bezel"` is AppKit's circular bezel. `"destructive"` is the flat
   * red disc with white content that Contacts draws to remove a field of a card: use it for
   * an action that deletes the thing it sits beside.
   * @default "bezel"
   */
  variant?: "bezel" | "destructive";
  /** Ref to the rendered element. */
  ref?: Ref<HTMLElement>;
}

/**
 * A Catalina round button (NSButton with the circular bezel style): a circular bezel around one
 * small glyph or a single character.
 *
 * Built on Base UI's Button, so it also accepts `disabled`, `focusableWhenDisabled`, `render`,
 * `nativeButton` and every native button attribute. It has no title, so give it an `aria-label`.
 */
export function RoundButton({
  size = "regular",
  variant = "bezel",
  className,
  ...props
}: RoundButtonProps) {
  return (
    <BaseButton
      data-size={size}
      data-variant={variant}
      className={withClassName("mac-round-button", className)}
      {...props}
    />
  );
}
