import { Button as BaseButton } from "@base-ui/react/button";
import type { ComponentProps, ReactNode } from "react";
import { cn, withClassName } from "../../lib/cn";
import "./section-header.tokens.css";
import "./section-header.css";

export interface SectionHeaderProps extends ComponentProps<"div"> {
  /**
   * How the header is drawn. `"plain"` is a header inside the scrolling content: a hairline
   * rule above the title, on the content's own background. `"pinned"` is the header held at
   * the top of the view while its group scrolls under it: a grey band with a separator under
   * it.
   * @default "plain"
   */
  variant?: "plain" | "pinned";
  /**
   * The heading level of the title: it is rendered as `<h1>` to `<h6>`. Use the level that
   * fits the page's outline.
   * @default 2
   */
  level?: 1 | 2 | 3 | 4 | 5 | 6;
  /**
   * The `id` of the title. Point the group at it with `aria-labelledby`, so that the group is
   * named by the title alone and not by the accessory beside it.
   */
  titleId?: string;
  /**
   * What sits at the trailing edge: usually a `SectionHeaderAction` ("Show All (553)"), or a
   * progress spinner while the group loads.
   */
  accessory?: ReactNode;
  /** The group's title. */
  children?: ReactNode;
}

/**
 * The header of a group in a grouped collection or list (an NSCollectionView section header;
 * Finder's "Use Groups"): the group's title in bold at the leading edge and an optional
 * accessory at the trailing edge, as wide as the view.
 *
 * It is a `<div>`; the title inside it is a heading element. Put it before the group it names
 * and point the group at the title with `titleId` and `aria-labelledby` when the group has a
 * role.
 */
export function SectionHeader({
  variant = "plain",
  level = 2,
  titleId,
  accessory,
  className,
  children,
  ...props
}: SectionHeaderProps) {
  const Title = `h${level}` as "h2";
  return (
    <div data-variant={variant} className={cn("mac-section-header", className)} {...props}>
      <Title id={titleId} className="mac-section-header-title">
        {children}
      </Title>
      {accessory === undefined || accessory === null || accessory === false ? null : (
        <span className="mac-section-header-accessory">{accessory}</span>
      )}
    </div>
  );
}

export interface SectionHeaderActionProps extends BaseButton.Props {}

/**
 * The text button at the trailing edge of a section header ("Show All (553)", "Show Less"):
 * secondary text without a bezel. Built on Base UI's Button.
 */
export function SectionHeaderAction({ className, ...props }: SectionHeaderActionProps) {
  return (
    <BaseButton className={withClassName("mac-section-header-action", className)} {...props} />
  );
}
