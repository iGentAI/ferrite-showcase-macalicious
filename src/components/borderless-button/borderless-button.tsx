import { Button as BaseButton } from "@base-ui/react/button";
import { withClassName } from "../../lib/cn";
import "./borderless-button.css";

export interface BorderlessButtonProps extends BaseButton.Props {
  /**
   * The colour of the title. `"inherit"` takes the colour of the text the button stands in;
   * `"link"` is the link colour, for a button that reads as a link ("Details" in Mail's
   * message header).
   * @default "inherit"
   */
  color?: "inherit" | "link";
}

/**
 * A button without a bezel (an NSButton whose `isBordered` is off): its title alone, in the
 * font and, unless `color` says otherwise, the colour of the text around it. For an action
 * that belongs to a line of text: "Details", "and 1 More", "Show Less".
 *
 * Built on Base UI's Button. To go somewhere, use a link: a `Label` rendered as `<a href>`.
 */
export function BorderlessButton({
  color = "inherit",
  className,
  ...props
}: BorderlessButtonProps) {
  return (
    <BaseButton
      data-color={color}
      className={withClassName("mac-borderless-button", className)}
      {...props}
    />
  );
}
