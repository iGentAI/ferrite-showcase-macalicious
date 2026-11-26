// Messages' census rows (R6, round 3): the crawl's (messages.crawled.mjs) with the family's shared rows and journeys
// (r6-family.mjs), tuned by id where the crawl cannot say how to reach or check a control.

import { CRAWLED } from "./messages.crawled.mjs";
import { familyRows } from "./r6-family.mjs";

const TUNE = {
  // Buddies has commands of its own now, where the crawl found a placeholder row.
  "messages.menu.buddies.this-demo-has-no-buddies-commands": {
    name: "Show Info",
    how: "menu bar Buddies > Show Info, with Ferrite Room selected (mouse)",
    expected: "the conversation's details open",
    probe: {
      where: "menu",
      menu: ["Buddies"],
      kind: "effect",
      reach: [{ role: "option", name: "Ferrite Room" }],
    },
  },
  // A fresh window opens on the room, selected already. Compose is dimmed while a draft is listed: it makes one if no
  // earlier probe left one, and either way the draft is listed and selected.
  "messages.conversations": { probe: { kind: "items", alreadySelected: true } },
  "messages.ferrite-room": { probe: { kind: "select", alreadySelected: true } },
  "messages.new-message": {
    probe: {
      kind: "select",
      alreadySelected: true,
      reach: [{ role: "button", name: "Compose new message", ifEnabled: true }],
    },
  },
  // A probe before it leaves a new draft selected, which has no Details: Ferrite Room first.
  "messages.details": {
    probe: { kind: "opens", reach: [{ role: "option", name: "Ferrite Room" }] },
  },
};

export const ROWS = familyRows("messages", CRAWLED, TUNE);
