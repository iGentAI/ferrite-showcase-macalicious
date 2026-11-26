"use client";

import { MenuItem } from "macalicious/menu-item";
import { TitleBar } from "macalicious/title-bar";
import { Window, WindowBody, type WindowProps } from "macalicious/window";
import { WindowControls, type WindowControlsProps } from "macalicious/window-controls";
import { type MouseEvent, type PointerEvent, type ReactNode, useState } from "react";
import { useDesktopAppMenu } from "../desktop/desktop-app-menus";
import { useWindowKeys } from "../desktop/desktop-window-keys";
import { type ContactActionDetail, ContactCard } from "./contacts-card";
import {
  type Contact,
  type ContactAction,
  type ContactNameOrder,
  type ContactService,
  displayNameIn,
} from "./contacts-data";

export interface ContactCardWindowProps extends Omit<WindowProps, "children"> {
  contact: Contact;
  /** Whether this window is editing the card. */
  editing: boolean;
  nameOrder: ContactNameOrder;
  services: readonly ContactService[];
  imageUrl?: string;
  pictureCommands?: ReactNode;
  onPictureFile?: (file: File) => void;
  onCardChange: (contact: Contact) => void;
  /** The edit of this card begins: Edit, or Card > Edit Card. */
  onEditBegin: () => void;
  /** The edit of this card ends: Done. */
  onEditEnd: () => void;
  onAdd: () => void;
  onAction: (action: ContactAction, detail: ContactActionDetail) => void;
  onPrint: () => void;
  controlsProps?: WindowControlsProps;
  onDragRegionPointerDown?: (event: PointerEvent<HTMLElement>) => void;
  onDragRegionDoubleClick?: (event: MouseEvent<HTMLElement>) => void;
}

/**
 * One card in a window of its own, as Card > Open in New Window and a double click on a name open it.
 * It is the same card as the main window's, edited in place. While it is the window last used, the menu
 * bar's commands are this window's, on this card: never the main window's selection.
 */
export function ContactCardWindow({
  contact,
  editing,
  nameOrder,
  services,
  imageUrl,
  pictureCommands,
  onPictureFile,
  onCardChange,
  onEditBegin,
  onEditEnd,
  onAdd,
  onAction,
  onPrint,
  controlsProps,
  onDragRegionPointerDown,
  onDragRegionDoubleClick,
  ...props
}: ContactCardWindowProps) {
  const [titleBar, setTitleBar] = useState<HTMLDivElement | null>(null);
  const edit = () => {
    if (!editing) onEditBegin();
  };
  const done = () => {
    if (editing) onEditEnd();
  };
  useDesktopAppMenu(
    "contacts",
    "File",
    <MenuItem keyEquivalent="command+p" onClick={onPrint}>
      Print…
    </MenuItem>,
    titleBar,
  );
  useDesktopAppMenu("contacts", "Edit", null, titleBar);
  useDesktopAppMenu("contacts", "View", null, titleBar);
  useDesktopAppMenu(
    "contacts",
    "Card",
    <MenuItem disabled={editing} keyEquivalent="command+l" onClick={edit}>
      Edit Card
    </MenuItem>,
    titleBar,
  );
  useWindowKeys(titleBar, props.state === "key", [
    { equivalent: "command+l", run: edit },
    { equivalent: "command+p", run: onPrint },
  ]);
  const title = displayNameIn(contact, nameOrder);
  return (
    <Window aria-label={`Card of ${title}`} className="mac-contacts-card-window" {...props}>
      <TitleBar
        ref={setTitleBar}
        title={title}
        controls={<WindowControls {...controlsProps} />}
        onDragRegionPointerDown={onDragRegionPointerDown}
        onDragRegionDoubleClick={onDragRegionDoubleClick}
      />
      <WindowBody background="content" className="mac-contacts-card">
        <ContactCard
          nameOrder={nameOrder}
          contact={contact}
          editing={editing}
          focusName={false}
          services={services}
          onChange={onCardChange}
          onEdit={edit}
          onDone={done}
          onAdd={onAdd}
          onAction={onAction}
          imageUrl={imageUrl}
          pictureCommands={pictureCommands}
          onPictureFile={onPictureFile}
        />
      </WindowBody>
    </Window>
  );
}
