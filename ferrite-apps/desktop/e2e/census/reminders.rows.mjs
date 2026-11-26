// Reminders' census rows (R6, round 3): the crawl's (reminders.crawled.mjs) with the family's shared rows and journeys
// (r6-family.mjs), tuned by id where the crawl cannot say how to reach or check a control.

import { familyRows } from "./r6-family.mjs";
import { CRAWLED } from "./reminders.crawled.mjs";

/**
 * The seeded reminders a fresh account's All list shows (five in Work, thirteen in iMac Colors): one kind, a reminder's
 * row, "<title><list>". The crawl listed each; they fold into reminders.bondiimac-colors, the kind's pattern row.
 */
const SEEDED = [
  "blue-dalmationimac-colors",
  "blueberryimac-colors",
  "book-a-room-for-the-workshopwork",
  "file-the-expense-reportwork",
  "flower-powerimac-colors",
  "grapeimac-colors",
  "graphiteimac-colors",
  "indigoimac-colors",
  "limeimac-colors",
  "reply-to-the-hiring-threadwork",
  "review-the-budget-draftwork",
  "rubyimac-colors",
  "sageimac-colors",
  "send-the-agenda-for-mondaywork",
  "snowimac-colors",
  "strawberryimac-colors",
  "tangerineimac-colors",
];

/** iMac Colors in the sidebar: an earlier probe's Add List leaves a new list selected across the app's reopening. */
const IMAC_COLORS = [{ role: "treeitem", name: "/^iMac Colors.*/" }];
const IN_IMAC_COLORS = [
  "blue-dalmation",
  "blueberry",
  "bondi",
  "flower-power",
  "grape",
  "graphite",
  "indigo",
  "lime",
  "ruby",
  "sage",
  "snow",
  "strawberry",
  "tangerine",
];

const TUNE = {
  // The list a fresh window opens on is selected already: another list first, so the click has something to change.
  "reminders.imac-colors-n": {
    probe: { kind: "select", reach: [{ role: "treeitem", name: "/^Work.*/" }] },
  },
  "reminders.imac-colors": { probe: { kind: "items", reach: IMAC_COLORS } },
  ...Object.fromEntries(
    IN_IMAC_COLORS.map((id) => [
      `reminders.${id}`,
      { probe: { kind: "select", reach: IMAC_COLORS } },
    ]),
  ),
  "reminders.bondiimac-colors": {
    name: "/.+(?:Work|iMac Colors)/",
    notes:
      "a reminder's row in All: its title, then its list's name (Work, iMac Colors); 18 seeded instances",
    probe: { kind: "select", reach: [{ role: "button", name: "/^All \\d+$/" }] },
  },
  ...Object.fromEntries(
    SEEDED.map((id) => [`reminders.${id}`, { instanceOf: "reminders.bondiimac-colors" }]),
  ),
  // The crawl's "New List" was a list it had added: Add List first, then New Reminder in it. Each Add List makes a
  // numbered list ("New List 2").
  "reminders.new-list": {
    name: "/New List(?: \\d+)?/",
    probe: {
      kind: "items",
      // Add List selects the list it makes, and New Reminder leaves it the only item.
      alreadySelected: true,
      reach: [
        { role: "button", name: "Add List" },
        { role: "button", name: "New Reminder" },
      ],
    },
  },
};

export const ROWS = familyRows("reminders", CRAWLED, TUNE);
