"use client";

import { Dialog } from "@base-ui/react/dialog";
import { Children, type CSSProperties, isValidElement, type ReactNode, useRef } from "react";
import { cn } from "../../lib/cn";
import { LaunchpadItem, type LaunchpadItemProps } from "../launchpad";
import "./launchpad-folder.tokens.css";
import "./launchpad-folder.css";

export interface LaunchpadFolderProps
  extends Omit<LaunchpadItemProps, "children" | "closeOnClick" | "render"> {
  /** The folder's name: under the closed tile, above the open panel, and what a search matches. */
  label: string;
  /** Whether the folder is open. Use with `onOpenChange` for controlled use. */
  open?: boolean;
  /**
   * Whether the folder is open at first, when uncontrolled.
   * @default false
   */
  defaultOpen?: boolean;
  /**
   * Called when the folder opens or closes: a click on its tile, Escape, a click outside the
   * panel, or a chosen item. The second argument is Base UI's event details.
   */
  onOpenChange?: Dialog.Root.Props["onOpenChange"];
  /**
   * The element the open folder is rendered into, which must be positioned. Inside a
   * `Launchpad` leave it out: the folder then covers the Launchpad it is in.
   */
  container?: Dialog.Portal.Props["container"];
  /**
   * Columns of the open folder's grid.
   * @default 7
   */
  columns?: number;
  /**
   * Accessible name of the area around the open panel, which closes the folder when clicked.
   * @default "Close folder"
   */
  closeLabel?: string;
  /**
   * What stands above the open panel in place of the name, such as a field that renames the folder.
   * The name still labels the closed tile.
   */
  heading?: ReactNode;
  /**
   * The folder's items: `LaunchpadItem` elements. The icons of the first nine are shown, small,
   * on the closed tile.
   */
  children?: ReactNode;
}

/** A Launchpad folder: a tile of up to nine small icons that opens into a panel of apps. */
export function LaunchpadFolder({
  label,
  open,
  defaultOpen,
  onOpenChange,
  container,
  columns = 7,
  closeLabel = "Close folder",
  heading,
  className,
  children,
  ...props
}: LaunchpadFolderProps) {
  const actions = useRef<Dialog.Root.Actions>(null);
  return (
    <Dialog.Root
      open={open}
      defaultOpen={defaultOpen}
      onOpenChange={onOpenChange}
      actionsRef={actions}
      modal="trap-focus"
    >
      <Dialog.Trigger
        render={
          <LaunchpadItem
            {...props}
            label={label}
            closeOnClick={false}
            className={cn("mac-launchpad-folder", className)}
          />
        }
      >
        <span className="mac-launchpad-folder-tile">
          {Children.toArray(children)
            .slice(0, 9)
            .map(
              (child) =>
                isValidElement<{ children?: ReactNode }>(child) && (
                  <span key={child.key} className="mac-launchpad-folder-mini">
                    {child.props.children}
                  </span>
                ),
            )}
        </span>
      </Dialog.Trigger>
      <Dialog.Portal container={container}>
        <Dialog.Popup className="mac-launchpad-folder-popup">
          <Dialog.Close
            className="mac-launchpad-folder-dismiss"
            aria-label={closeLabel}
            tabIndex={-1}
          />
          <Dialog.Title className="mac-launchpad-folder-title">{heading ?? label}</Dialog.Title>
          {/* biome-ignore lint/a11y/noStaticElementInteractions: hears the clicks of the items inside it, which close the folder */}
          {/* biome-ignore lint/a11y/useKeyWithClickEvents: the items are buttons; Return and Space click them */}
          <div
            className="mac-launchpad-folder-panel"
            data-columns={columns}
            style={{ "--_columns": columns } as CSSProperties}
            onClick={(event) => event.target !== event.currentTarget && actions.current?.close()}
          >
            {children}
          </div>
        </Dialog.Popup>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
