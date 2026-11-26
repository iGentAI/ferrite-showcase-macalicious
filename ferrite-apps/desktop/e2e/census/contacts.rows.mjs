// Contacts' census rows (R6, round 3): the crawl's (contacts.crawled.mjs) with the family's shared rows and journeys
// (r6-family.mjs), tuned by id where the crawl cannot say how to reach or check a control.

import { CRAWLED } from "./contacts.crawled.mjs";
import { familyRows } from "./r6-family.mjs";

const TUNE = {
  // Info is the pane a card being edited opens on: Picture first, so choosing Info changes what the card shows.
  "contacts.info": {
    probe: {
      kind: "effect",
      reach: [
        { role: "button", name: "New Contact" },
        { role: "button", name: "Picture" },
      ],
    },
  },
  // A fresh account opens on its own card, which has no phone number or email: these buttons are dimmed there and say
  // why (bundle 03), like call and video.
  "contacts.message": {
    probe: { kind: "dimmed" },
    how: "hover message on the account's own card",
    expected: "dimmed, with the reason shown",
  },
  "contacts.mail": {
    probe: { kind: "dimmed" },
    how: "hover mail on the account's own card",
    expected: "dimmed, with the reason shown",
  },
  // The group a fresh window opens on is selected already.
  "contacts.all-contacts-2": { probe: { kind: "select", alreadySelected: true } },
  // The On My Mac group lists its cards only while it holds one: a card is added to it first.
  "contacts.all-on-my-mac": {
    probe: {
      kind: "items",
      // New Contact selects the card it makes, and it is the group's only one.
      alreadySelected: true,
      reach: [
        { role: "treeitem", name: "All on My Mac" },
        { role: "button", name: "New Contact" },
      ],
    },
  },
  // The account's own card: "<full name>, my card" (a run's account name has capitals: "Tune chmvkw1grl").
  "contacts.person-my-card": { name: "/.+, my card/" },
};

export const ROWS = familyRows("contacts", CRAWLED, TUNE);
