import {
  type DesktopDrag,
  type DesktopDragItem,
  type DropLanding,
  landingAt,
} from "../desktop/desktop-drag";
import { addressFor, type Contact } from "./contacts-data";

/** Mail's `ADDRESS_DRAG_TYPE`: an item of this type names, in `name`, whom it reaches. */
export const ADDRESS_DRAG_TYPE = "application/x-macalicious-address";

const ID_PREFIX = "address:card:";

/** What a card leaves the list as: its address for an address field, or a vCard file for the rest. */
export interface CardDragItems {
  addresses: readonly DesktopDragItem[];
  file: DesktopDragItem;
}

/** A card's address item: its mail address, or else its account name, with the account in the id. */
function addressItem(card: Contact): DesktopDragItem | null {
  const address = addressFor(card, "mail") ?? card.user;
  if (!address) return null;
  return {
    id: `${ID_PREFIX}${card.user ?? ""}:${card.id}`,
    name: address,
    kind: "file",
    type: ADDRESS_DRAG_TYPE,
    bytes: async () => new Blob([address], { type: "text/plain" }),
  };
}

/** The account name of a card dragged here, empty when the card has none. */
export const accountOfDrag = (item: DesktopDragItem) =>
  item.id.startsWith(ID_PREFIX) ? (item.id.slice(ID_PREFIX.length).split(":")[0] ?? "") : "";

/** The items of cards being dragged, `vcard` being their text and `name` its file's. */
export function cardDragItems(
  cards: readonly Contact[],
  vcard: string,
  name: string,
): CardDragItems {
  return {
    addresses: cards.flatMap((card) => addressItem(card) ?? []),
    file: {
      id: `vcard:${cards.map(({ id }) => id).join(",")}`,
      name,
      kind: "file",
      type: "text/vcard",
      size: new Blob([vcard]).size,
      bytes: async () => new Blob([vcard], { type: "text/vcard" }),
    },
  };
}

/**
 * What letting the cards go on `hit` does. A target made for addresses answers an address item from
 * an element of its own, as Mail's To field does inside its window, and takes the address. Any other
 * target, which takes the two alike or the file alone, takes the vCard.
 */
export function landingOfCards(
  hit: Element | null,
  { addresses, file }: CardDragItems,
  at: { x: number; y: number },
): DropLanding | undefined {
  const drag = (items: readonly DesktopDragItem[]): DesktopDrag => ({
    from: "contacts",
    items,
    copy: true,
    at,
  });
  const asFile = landingAt(hit, drag([file]));
  const asAddress = addresses.length > 0 ? landingAt(hit, drag(addresses)) : undefined;
  return asAddress && asAddress.element !== asFile?.element ? asAddress : asFile;
}

/**
 * Offers a browser drag of cards to the desktop's drop targets until it ends. The list's rows stay
 * the browser's own drag, since only that one can leave the browser as a file: this hears where it
 * goes, and a target that answers takes the drop; elsewhere the page's own handlers do as before.
 */
export function followCardDrag(items: CardDragItems): void {
  const page = document.documentElement;
  let marked: Element | null = null;
  const mark = (element: Element | null, accepted: boolean) => {
    if (marked !== element) marked?.removeAttribute("data-desktop-drop");
    marked = element;
    element?.setAttribute("data-desktop-drop", accepted ? "accept" : "refuse");
  };
  const landing = (event: DragEvent) =>
    landingOfCards(document.elementFromPoint(event.clientX, event.clientY), items, {
      x: event.clientX,
      y: event.clientY,
    });
  const over = (event: DragEvent) => {
    const found = landing(event);
    mark(found?.element ?? null, !found?.refusal);
    if (!found || found.refusal || !event.dataTransfer) return;
    event.preventDefault();
    event.dataTransfer.dropEffect = "copy";
  };
  const finish = () => {
    window.removeEventListener("dragover", over, true);
    window.removeEventListener("drop", dropped, true);
    window.removeEventListener("dragend", finish, true);
    mark(null, true);
    delete page.dataset.desktopDragging;
  };
  const dropped = (event: DragEvent) => {
    const found = landing(event);
    finish();
    if (!found) return;
    event.preventDefault();
    event.stopPropagation();
    if (found.refusal) found.sayRefusal?.(found.refusal);
    else found.drop();
  };
  page.dataset.desktopDragging = "";
  window.addEventListener("dragover", over, true);
  window.addEventListener("drop", dropped, true);
  window.addEventListener("dragend", finish, true);
}

/** Whether a file is a vCard, by its type or its name. */
export const isVCardFile = (file: { name: string; type?: string | null }) =>
  /vcard/i.test(file.type ?? "") || /\.(vcf|vcard)$/i.test(file.name);

/**
 * What a drag from another application does on Contacts' window: its vCard files go to `take`, and
 * anything else is refused. The window's own cards pass, because `followCardDrag` would otherwise
 * keep them from the group rows' own drop handlers.
 */
export function vCardLanding(
  element: Element,
  drag: DesktopDrag,
  take: (files: DesktopDragItem[]) => void,
  say: (refusal: string) => void,
): DropLanding | undefined {
  if (drag.from === "contacts") return undefined;
  const files = drag.items.filter((item) => item.kind === "file" && isVCardFile(item));
  const names = drag.items.map((item) => item.name).join(", ");
  return {
    element,
    copies: true,
    refusal: files.length > 0 ? undefined : `“${names}” is not a vCard file.`,
    sayRefusal: say,
    drop: () => take(files),
  };
}

/** Why a card without an account cannot go where only an account can. */
export const noAccountRefusal = (items: readonly DesktopDragItem[]) =>
  `${items.map((item) => item.name).join(", ")} has no account on this desktop.`;
