import { displayName, sortContacts } from "../contacts/contacts-data";
import { newPictureVersion, pictureFromBlob } from "../contacts/contacts-picture";
import {
  CONTACTS_CARDS_URL,
  cardsFromServer,
  deletePicture,
  savePicture,
} from "../contacts/contacts-server";
import { serverDocument } from "../desktop/desktop-server";
import { encodeJpeg, NO_EDIT, renderEdit } from "../photos/photos-edit";
import {
  decodePicture,
  LibraryError,
  type LibraryPhoto,
  readOriginal,
} from "../photos/photos-library";

/*
 * Set Contact Picture: a picture of the strip becomes a card's picture, as a picture chosen in
 * Contacts does. It is kept beside the cards first, then named by the card. The cards go through the
 * desktop's one document of them, so a Contacts window that is open is given the change, and a
 * change another browser made first is not overwritten.
 */

/** A card to choose. */
export interface ContactChoice {
  id: string;
  name: string;
}

/** The longer side a photo is drawn at before Contacts' own square is cut from it. */
const DRAWN_SIDE = 1024;

/** The person's cards in the order Contacts lists them. Rejects when they cannot be read. */
export async function contactChoices(): Promise<ContactChoice[]> {
  const reply = await serverDocument(CONTACTS_CARDS_URL).load();
  if (reply === undefined) throw new LibraryError("your cards could not be read", 0);
  return sortContacts(cardsFromServer(reply) ?? []).map((card) => ({
    id: card.id,
    name: displayName(card),
  }));
}

/**
 * Make `photo`, with its edit, the picture of card `id`. Rejects, leaving the card as it was named
 * before, when the picture cannot be made or kept, or the card is gone or was changed elsewhere first.
 */
export async function setContactPicture(photo: LibraryPhoto, id: string): Promise<void> {
  const decoded = await decodePicture(await readOriginal(photo));
  let drawn: Blob | null;
  try {
    drawn = await encodeJpeg(
      renderEdit(decoded, photo.edit ?? NO_EDIT, DRAWN_SIDE),
      Number.MAX_SAFE_INTEGER,
      [0.9],
    );
  } finally {
    decoded.close();
  }
  if (!drawn) throw new LibraryError("this browser could not draw the photo", 0);
  const image = await pictureFromBlob(drawn);
  const version = newPictureVersion();
  await savePicture(id, version, image);
  const cards = serverDocument(CONTACTS_CARDS_URL);
  const named = (reply: unknown) =>
    (reply as { cards?: { id?: unknown; image?: unknown }[] | null } | null)?.cards?.find(
      (card) => card.id === id,
    );
  const reply = await cards.load();
  const held = (reply as { cards?: { id?: unknown }[] | null } | null)?.cards;
  if (!Array.isArray(held) || !named(reply)) {
    await deletePicture(id, version);
    throw new LibraryError("that card is no longer there", 0);
  }
  cards.save({ cards: held.map((card) => (card.id === id ? { ...card, image: version } : card)) });
  await cards.idle();
  if ((named(await cards.load()) as { image?: unknown } | undefined)?.image !== version) {
    await deletePicture(id, version);
    throw new LibraryError("your cards were changed elsewhere first", 0);
  }
}
