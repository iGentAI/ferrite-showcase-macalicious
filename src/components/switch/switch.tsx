import { Switch as BaseSwitch } from "@base-ui/react/switch";
import type { Ref } from "react";
import { withClassName } from "../../lib/cn";
import type { ControlSize } from "../../lib/control-size";
import "./switch.tokens.css";
import "./switch.css";

export interface SwitchProps extends Omit<BaseSwitch.Root.Props, "ref" | "children"> {
  /**
   * AppKit control size. Catalina's `NSSwitch` has the regular size only; `"small"` and
   * `"mini"` arrived with macOS 11 and are drawn here in the Catalina style.
   * @default "regular"
   */
  size?: ControlSize;
  /** Ref to the rendered element, the one with `role="switch"`. */
  ref?: Ref<HTMLElement>;
}

/**
 * A Catalina switch (NSSwitch): a capsule with a knob that slides between off and on.
 *
 * Built on Base UI's Switch, so it also accepts `checked`, `defaultChecked`,
 * `onCheckedChange`, `disabled`, `readOnly`, `required`, `name`, `value`, `uncheckedValue`,
 * `inputRef`, `nativeButton` and `render`. It has no title of its own: label it with a
 * wrapping `<label>`, `aria-label` or `aria-labelledby`.
 */
export function Switch({ size = "regular", className, ...props }: SwitchProps) {
  return (
    <BaseSwitch.Root data-size={size} className={withClassName("mac-switch", className)} {...props}>
      <BaseSwitch.Thumb className="mac-switch-thumb" />
    </BaseSwitch.Root>
  );
}
