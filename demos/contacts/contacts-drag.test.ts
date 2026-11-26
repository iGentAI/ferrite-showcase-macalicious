import { afterEach, describe, expect, it, vi } from "vitest";
import { type DesktopDragItem, registerDropTarget } from "../desktop/desktop-drag";
import { ADDRESS_DRAG_TYPE as MAIL_ADDRESS_TYPE } from "../mail/mail-compose";
import type { Contact } from "./contacts-data";
import {
  ADDRESS_DRAG_TYPE,
  accountOfDrag,
  cardDragItems,
  followCardDrag,
  landingOfCards,
  vCardLanding,
} from "./contacts-drag";
import { cropSquare } from "./contacts-picture";

const ada = {
  id: "ada",
  account: "icloud",
  first: "Ada",
  last: "Lovelace",
  emails: [{ label: "home", value: "ada@example.com" }],
} as Contact;
const bob = { id: "bob", account: "icloud", first: "Bob", last: "Ray", user: "bob" } as Contact;
const items = cardDragItems([ada, bob], "BEGIN:VCARD", "Ada and Bob.vcf");

const removes: (() => void)[] = [];
const element = (parent: Element = document.body) => {
  const made = document.createElement("div");
  parent.append(made);
  removes.push(() => made.remove());
  return made;
};
const target = (at: Element, accepts: (type: string | undefined) => boolean) => {
  const drop = vi.fn();
  removes.push(
    registerDropTarget({
      element: at,
      landing: (_hit, drag) =>
        drag.items.some((item) => accepts(item.type))
          ? { element: at, drop: () => drop(drag.items.map((item) => item.name)) }
          : undefined,
    }),
  );
  return drop;
};

afterEach(() => {
  for (const remove of removes.splice(0)) remove();
});

describe("a card dragged out of the list", () => {
  it("goes by Mail's own drag type", () => {
    expect(ADDRESS_DRAG_TYPE).toBe(MAIL_ADDRESS_TYPE);
  });

  it("names each card's mail address, or its desktop address, and keeps its account", () => {
    expect(items.addresses.map(({ name }) => name)).toEqual([
      "ada@example.com",
      expect.stringContaining("bob"),
    ]);
    expect(items.addresses.map(accountOfDrag)).toEqual(["", "bob"]);
    expect(items.file).toMatchObject({ name: "Ada and Bob.vcf", kind: "file", type: "text/vcard" });
  });

  it("gives an address field the addresses and the window around it the file", () => {
    const windowElement = element();
    const field = element(windowElement);
    const body = element(windowElement);
    const attach = target(windowElement, (type) => type !== ADDRESS_DRAG_TYPE);
    const address = target(field, (type) => type === ADDRESS_DRAG_TYPE);
    landingOfCards(field, items, { x: 0, y: 0 })?.drop();
    expect(address).toHaveBeenCalledWith(["ada@example.com", expect.stringContaining("bob")]);
    expect(attach).not.toHaveBeenCalled();
    landingOfCards(body, items, { x: 0, y: 0 })?.drop();
    expect(attach).toHaveBeenCalledWith(["Ada and Bob.vcf"]);
  });

  it("gives a target that takes anything the vCard file", () => {
    const folder = element();
    const drop = target(folder, () => true);
    landingOfCards(folder, items, { x: 0, y: 0 })?.drop();
    expect(drop).toHaveBeenCalledWith(["Ada and Bob.vcf"]);
  });

  it("lets a browser drop land on a target, and leaves other drops to the page", () => {
    const folder = element();
    const drop = target(folder, () => true);
    const fired = (type: string) => {
      const event = new Event(type, { bubbles: true, cancelable: true }) as DragEvent;
      Object.assign(event, { clientX: 1, clientY: 1 });
      return event;
    };
    const hit = vi.fn(() => folder as Element);
    document.elementFromPoint = hit;
    followCardDrag(items);
    expect(document.documentElement.dataset.desktopDragging).toBe("");
    const onto = fired("drop");
    folder.dispatchEvent(onto);
    expect(onto.defaultPrevented).toBe(true);
    expect(drop).toHaveBeenCalledTimes(1);
    expect(document.documentElement.dataset.desktopDragging).toBeUndefined();

    const elsewhere = element();
    hit.mockReturnValue(elsewhere);
    followCardDrag(items);
    const other = fired("drop");
    elsewhere.dispatchEvent(other);
    expect(other.defaultPrevented).toBe(false);
    expect(drop).toHaveBeenCalledTimes(1);
  });
});

describe("a drag from another application onto Contacts' window", () => {
  const file = (name: string, type?: string): DesktopDragItem => ({
    id: name,
    name,
    kind: "file",
    type,
  });
  const land = (from: string, dragged: DesktopDragItem[]) => {
    const take = vi.fn();
    const say = vi.fn();
    const at = document.createElement("div");
    return {
      take,
      say,
      landing: vCardLanding(at, { from, items: dragged, copy: false }, take, say),
    };
  };

  it("takes the vCard files of the drag, by name or by type, and leaves the rest", () => {
    const card = file("Ada.VCF");
    const typed = file("Bob", "text/x-vcard");
    const { take, landing } = land("finder", [card, file("notes.txt", "text/plain"), typed]);
    expect(landing?.refusal).toBeUndefined();
    expect(landing?.copies).toBe(true);
    landing?.drop();
    expect(take).toHaveBeenCalledWith([card, typed]);
  });

  it("refuses a drag with no vCard, by name", () => {
    const { landing } = land("finder", [file("notes.txt", "text/plain")]);
    expect(landing?.refusal).toBe("“notes.txt” is not a vCard file.");
  });

  it("does not take a folder that happens to be named like a vCard", () => {
    const { landing } = land("finder", [{ id: "f", name: "old.vcf", kind: "folder" }]);
    expect(landing?.refusal).toBe("“old.vcf” is not a vCard file.");
  });

  it("lets the window's own cards pass to the group rows", () => {
    expect(land("contacts", [items.file]).landing).toBeUndefined();
  });
});

describe("how a picture is framed", () => {
  it("keeps the middle square at first", () => {
    expect(cropSquare(200, 100, { zoom: 1, x: 0.5, y: 0.5 })).toEqual({ sx: 50, sy: 0, side: 100 });
  });
  it("moves the square to the left edge", () => {
    expect(cropSquare(200, 100, { zoom: 1, x: 0, y: 0.5 })).toEqual({ sx: 0, sy: 0, side: 100 });
  });
  it("zooms into a smaller square", () => {
    expect(cropSquare(200, 100, { zoom: 2, x: 1, y: 1 })).toEqual({ sx: 150, sy: 50, side: 50 });
  });
});
