import { Button as BaseButton } from "@base-ui/react/button";
import type { ReactNode, Ref } from "react";
import { withClassName } from "../../lib/cn";
import "./image-button.css";

export interface ImageButtonProps extends Omit<BaseButton.Props, "ref" | "children"> {
  /**
   * The image: an `<img>`, an inline SVG or any other element. It is the button's content.
   * Without it the button shows only its `label`, and the focus ring surrounds the label.
   */
  children?: ReactNode;
  /**
   * Text shown centred under the image (AppKit's `imagePosition = .imageAbove`), on up to two
   * lines. It also names the button.
   */
  label?: ReactNode;
  /**
   * `icon` is the image at its own size, with the label under it. `row` is a full-width row
   * 54 pt tall with its content centred, like an account provider of Internet Accounts; its
   * content is a logo or a title in the body font.
   * @default "icon"
   */
  layout?: "icon" | "row";
  /** Ref to the rendered element. */
  ref?: Ref<HTMLElement>;
}

/**
 * A Catalina image button (a borderless NSButton with an image): an image, optionally with a
 * label under it, that starts an action when clicked, like an icon of System Preferences.
 *
 * Built on Base UI's Button, so it also accepts `disabled`, `focusableWhenDisabled`, `render`
 * and every native button attribute. Without a `label`, give the image an `alt` text or the
 * button an `aria-label`.
 */
export function ImageButton({
  label,
  layout = "icon",
  className,
  children,
  ...props
}: ImageButtonProps) {
  return (
    <BaseButton
      data-layout={layout}
      className={withClassName("mac-image-button", className)}
      {...props}
    >
      {children == null || typeof children === "boolean" ? null : (
        <span className="mac-image-button-image">{children}</span>
      )}
      {label == null ? null : <span className="mac-image-button-label">{label}</span>}
    </BaseButton>
  );
}
