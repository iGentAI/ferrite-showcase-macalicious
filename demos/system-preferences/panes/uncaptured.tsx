"use client";

import {
  Popover,
  PopoverDescription,
  PopoverPopup,
  PopoverTitle,
  PopoverTrigger,
} from "macalicious/popover";
import { cloneElement, type MouseEvent, type ReactElement, use, useState } from "react";
import { DesktopWindowHostContext } from "../../desktop/desktop-windows";

export interface UncapturedProps {
  /** The control's title as its pane shows it, such as "Advanced…". */
  action: string;
  /** The control: one button of the library, which becomes the popover's trigger. */
  children: ReactElement<Record<string, unknown>>;
  /**
   * Whether the control is a `<button>`. Pass `false` for a link, which stays a link: the
   * popover is anchored to it and its click opens the popover instead of following the link.
   * @default true
   */
  nativeButton?: boolean;
  /**
   * Why the control does nothing on this desktop, when the reason is not a missing screenshot ("A web page cannot
   * switch Wi-Fi."). The popover says this instead.
   */
  reason?: string;
}

/**
 * A button or link of a pane whose sheet, dialog or window is in no reference screenshot. The demo does
 * not invent what Catalina shows there: a click opens a popover on the button that says so, so
 * the button answers instead of doing nothing. Shared by the panes; it is not a pane itself.
 *
 * Help is the exception on a desktop: it opens Help Viewer there, and says so nowhere else.
 */
export function Uncaptured({ action, children, nativeButton = true, reason }: UncapturedProps) {
  const [open, setOpen] = useState(false);
  const [link, setLink] = useState<Element | null>(null);
  const launch = use(DesktopWindowHostContext)?.launch;
  if (action === "Help" && launch) {
    return cloneElement(children, { onClick: () => launch("help-viewer") });
  }
  return (
    <Popover open={open} onOpenChange={setOpen}>
      {nativeButton ? (
        <PopoverTrigger render={children} />
      ) : (
        cloneElement(children, {
          ref: setLink,
          "aria-haspopup": "dialog",
          "aria-expanded": open,
          onClick: (event: MouseEvent) => {
            event.preventDefault();
            setOpen(true);
          },
        })
      )}
      <PopoverPopup anchor={nativeButton ? undefined : link} style={{ width: 236 }}>
        <PopoverTitle>Not part of this demo</PopoverTitle>
        <PopoverDescription>
          {reason ??
            `No reference screenshot shows what “${action}” opens, so the demo stops here.`}
        </PopoverDescription>
      </PopoverPopup>
    </Popover>
  );
}
