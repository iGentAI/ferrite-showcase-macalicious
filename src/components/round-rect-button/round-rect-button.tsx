import { Button as BaseButton } from "@base-ui/react/button";
import type { Ref } from "react";
import { withClassName } from "../../lib/cn";
import "./round-rect-button.tokens.css";
import "./round-rect-button.css";

export interface RoundRectButtonProps extends Omit<BaseButton.Props, "ref"> {
  /** Ref to the rendered element. */
  ref?: Ref<HTMLElement>;
}

/**
 * A Catalina round-rect button (NSButton with the round-rect bezel style): a small outlined
 * button without a fill, 18 pt high, for an action that belongs to the content beside it,
 * such as "Connect As…" under a server in Finder's preview column.
 *
 * Built on Base UI's Button, so it also accepts `disabled`, `focusableWhenDisabled`, `render`
 * and every native button attribute. It has one size.
 */
export function RoundRectButton({ className, ...props }: RoundRectButtonProps) {
  return <BaseButton className={withClassName("mac-round-rect-button", className)} {...props} />;
}
