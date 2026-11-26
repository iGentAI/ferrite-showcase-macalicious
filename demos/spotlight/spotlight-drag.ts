import type { DesktopDragItem } from "../desktop/desktop-drag";
import { sessionFetch } from "../desktop/desktop-server";
import type { DataResult } from "./spotlight-desktop";

const read = async (url: string): Promise<unknown> => {
  const reply = await sessionFetch(url, { credentials: "same-origin" });
  if (!reply.ok) throw new Error(`${url} answered ${reply.status}`);
  return reply.json();
};

/*
 * What a found item is when it is dragged out of Spotlight: a file on the drive is itself, a contact
 * a vCard and an event an iCalendar file, written from the person's stored document when it lands.
 * Other kinds have no file form here and do not drag.
 */
export function dragItemOf(result: DataResult): DesktopDragItem | null {
  if (result.kind === "files") return { id: result.id, name: result.title, kind: "file" };
  if (result.app === "contacts") {
    return {
      id: `vcard:${result.id}`,
      name: `${result.title}.vcf`,
      kind: "file",
      type: "text/vcard",
      bytes: async () => {
        const { cardsFromServer } = await import("../contacts/contacts-server");
        const { cardsToVCard, VCARD_TYPE } = await import("../contacts/contacts-vcard");
        const card = cardsFromServer(await read("/api/contacts/cards"))?.find(
          (each) => each.id === result.id,
        );
        if (!card) throw new Error("The card is no longer there.");
        return new Blob([cardsToVCard([{ contact: card }])], { type: VCARD_TYPE });
      },
    };
  }
  if (result.app === "calendar") {
    return {
      id: `ics:${result.id}`,
      name: `${result.title}.ics`,
      kind: "file",
      type: "text/calendar",
      bytes: async () => {
        const { CALENDAR_EVENTS_URL, documentFromServer } = await import(
          "../calendar/calendar-server"
        );
        const { eventsToIcs } = await import("../calendar/calendar-ics");
        const event = documentFromServer(await read(CALENDAR_EVENTS_URL))?.events?.find(
          (each) => each.id === result.id,
        );
        if (!event) throw new Error("The event is no longer there.");
        return new Blob([eventsToIcs([event])], { type: "text/calendar" });
      },
    };
  }
  return null;
}
