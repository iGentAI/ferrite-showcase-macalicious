"use client";

import { Menu as BaseMenu } from "@base-ui/react/menu";
import type { ReactElement, ReactNode, Ref } from "react";
import { withClassName } from "../../lib/cn";
import { MenuPopup, type MenuPopupProps } from "../menu";
import { MenuItem, type MenuItemProps, MenuSeparator } from "../menu-item";
import { ToolbarButton } from "../toolbar-button";
import "./share-menu.css";

/* Glyphs drawn for this library: a tray with an arrow leaving it, and an ellipsis in a circle.
   Neither is Apple's artwork. */
const shareGlyph = (
  <svg viewBox="0 0 14 17" width="14" height="17" aria-hidden="true" focusable="false">
    <path
      d="M4.5 6.5h-3v9h11v-9h-3M7 11V1.2M4 4l3-3 3 3"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.1"
    />
  </svg>
);

const moreGlyph = (
  <svg viewBox="0 0 16 16" width="16" height="16" aria-hidden="true" focusable="false">
    <circle cx="8" cy="8" r="6.4" fill="none" stroke="currentColor" strokeWidth="1.1" />
    <path d="M4.2 8h1.6M7.2 8h1.6M10.2 8h1.6" stroke="currentColor" strokeWidth="1.6" />
  </svg>
);

/* A row's content: the icon in its 16 pt column, then the title. The row is 5 pt higher than
   the icon: 21 pt with a 16 pt icon, 20 pt with a 15 pt glyph, as in Safari's menu. */
const row = (image: ReactNode, title: ReactNode) => (
  <>
    {image != null && <span className="mac-share-menu-image">{image}</span>}
    {title}
  </>
);

export interface ShareMenuProps
  extends Omit<BaseMenu.Trigger.Props, "ref" | "children" | "render"> {
  /**
   * The control that opens the menu, as an element. Without it the menu has a Share button: a
   * `ToolbarButton` named "Share" with a share glyph drawn for this library.
   */
  trigger?: ReactElement<Record<string, unknown>>;
  /** Whether the menu is open, when controlled. Use it with `onOpenChange`. */
  open?: boolean;
  /**
   * Whether the menu is open at first, when uncontrolled.
   * @default false
   */
  defaultOpen?: boolean;
  /** Called when the menu opens or closes. */
  onOpenChange?: BaseMenu.Root.Props["onOpenChange"];
  /**
   * Whether the page behind the open menu takes no clicks and does not scroll, as in AppKit.
   * @default true
   */
  modal?: boolean;
  /**
   * Called when the last item, More…, is chosen: in Catalina it opens the Extensions
   * preference pane. Without it the menu has no More… item and no separator before it.
   */
  onMore?: () => void;
  /**
   * Title of the last item.
   * @default "More…"
   */
  moreLabel?: ReactNode;
  /**
   * Props for the menu itself, a `MenuPopup`: `container`, `style` (a `width`), `side`,
   * `align`, `alignOffset`. `sideOffset` is 3 unless given here: in Safari the menu hangs 3 pt
   * below the Share button, under the toolbar's lower edge.
   */
  popupProps?: MenuPopupProps;
  /** The services: `ShareMenuItem` elements. */
  children?: ReactNode;
  /** Ref to the button. */
  ref?: Ref<HTMLElement>;
}

/**
 * The Share menu (NSSharingServicePicker): a Share button that opens a menu of services, each
 * with its icon, then a separator and More….
 *
 * Built on Base UI's Menu with the library's menu: the button is the menu's trigger and the
 * children are `ShareMenuItem`s. The props listed here configure the menu; every other prop,
 * `aria-label`, `disabled`, `className`, `style` and `ref` included, goes to the button.
 */
export function ShareMenu({
  trigger,
  open,
  defaultOpen = false,
  onOpenChange,
  modal = true,
  onMore,
  moreLabel = "More…",
  popupProps,
  className,
  children,
  ...props
}: ShareMenuProps) {
  return (
    <BaseMenu.Root open={open} defaultOpen={defaultOpen} onOpenChange={onOpenChange} modal={modal}>
      <BaseMenu.Trigger
        aria-label={trigger ? undefined : "Share"}
        render={trigger ?? <ToolbarButton />}
        className={withClassName(
          trigger ? "mac-share-menu" : "mac-share-menu mac-share-menu-button",
          className,
        )}
        {...(props as BaseMenu.Trigger.Props)}
      >
        {trigger ? undefined : shareGlyph}
      </BaseMenu.Trigger>
      <MenuPopup sideOffset={3} {...popupProps}>
        {children}
        {onMore && (
          <>
            <MenuSeparator />
            <MenuItem className="mac-share-menu-item" onClick={onMore}>
              {row(moreGlyph, moreLabel)}
            </MenuItem>
          </>
        )}
      </MenuPopup>
    </BaseMenu.Root>
  );
}

export interface ShareMenuItemProps extends Omit<MenuItemProps, "image"> {
  /**
   * The service's icon: an image of your own, 16 pt high, or a 15 pt template glyph drawn with
   * `currentColor`. No application icons are included.
   */
  image?: ReactNode;
}

/**
 * One service in a Share menu: a menu item with its icon, 17 pt from the menu's edge. It takes
 * the props of `MenuItem`; `onClick` shares.
 */
export function ShareMenuItem({ image, className, children, ...props }: ShareMenuItemProps) {
  return (
    <MenuItem className={withClassName("mac-share-menu-item", className)} {...props}>
      {row(image, children)}
    </MenuItem>
  );
}
