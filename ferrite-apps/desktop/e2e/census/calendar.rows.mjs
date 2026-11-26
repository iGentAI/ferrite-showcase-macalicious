// Calendar's census rows (R6, round 3): the crawl's (calendar.crawled.mjs) with the family's shared rows and journeys
// (r6-family.mjs), tuned by id where the crawl cannot say how to reach or check a control.

import { CRAWLED } from "./calendar.crawled.mjs";
import { familyRows } from "./r6-family.mjs";

/** The step of calendar-drag-journey that makes the events whose blocks it then drags. */
const EVENTS = [["calendar-drag-journey.mjs", /Thursday review and a Monday standup/]];

const TUNE = {
  // The calendar list's rows are named by their checkbox and their name ("Show Home Home"); a person's click selects one
  // (checked with the real mouse, debug/mouse-facts.mjs). Work is selected at first: Home first.
  "calendar.home": { name: "Show Home Home" },
  "calendar.work": {
    name: "Show Work Work",
    probe: { kind: "select", reach: [{ role: "treeitem", name: "Show Home Home" }] },
  },
  "calendar.us-holidays": { name: "US Holidays Subscribed" },
  "calendar.siri-suggestions": { name: "Show Siri Suggestions Siri Suggestions" },
  // A day is named by its date ("Thursday, October 15, 2026"); clicking one shows its week.
  "calendar.n": {
    name: "/(?:Sunday|Monday|Tuesday|Wednesday|Thursday|Friday|Saturday), (?:January|February|March|April|May|June|July|August|September|October|November|December) \\d+, \\d+/",
    probe: {
      kind: "effect",
      reach: [
        { role: "button", name: "Week" },
        { role: "button", name: "Next week" },
      ],
    },
  },
  "calendar.n-2": { instanceOf: "calendar.n" },
  // The mini month's weekday header: a row a person reads, not operates (its cells show S M T W T F S).
  "calendar.smtwtfs": {
    name: "Sunday Monday Tuesday Wednesday Thursday Friday Saturday",
    probe: { kind: "shows" },
    expected: "the weekday initials head the mini month",
  },
  // The Calendars button hides the calendar list and the mini month, and Calendar keeps them hidden: pressed again after.
  "calendar.calendars": {
    probe: { kind: "effect", after: [{ role: "button", name: "Calendars" }] },
  },
  // Week is the view Calendar opens in: Day first, so choosing Week changes the view.
  "calendar.week": { probe: { kind: "effect", reach: [{ role: "button", name: "Day" }] } },
  // Calendar keeps the view it was left in across a quit, and Year hides the calendar list and the mini month: each view
  // probe returns to Week after.
  "calendar.day": { probe: { kind: "effect", after: [{ role: "button", name: "Week" }] } },
  "calendar.month": { probe: { kind: "effect", after: [{ role: "button", name: "Week" }] } },
  "calendar.year": { probe: { kind: "effect", after: [{ role: "button", name: "Week" }] } },
  // The new event's date button: its hour is when the run makes it, with two spaces before it.
  "calendar.date-oct-n-n-n-am-to-n-am": {
    name: "/Date: [A-Z][a-z]{2} \\d+, \\d+\\s+\\d+ [AP]M to \\d+ [AP]M/",
  },
  // An event's block in the grid exists once an event does: calendar-drag-journey makes two and drags them.
  "calendar.new-event-weekday-month-n-n-n-am-n-am": { probe: null, journey: EVENTS },
  "calendar.new-eventn-frin-am-to-n-am": { probe: null, journey: EVENTS },
  // The Drive panel's location pop-up lists the folder shown and the folders above it, so at a top folder (Documents)
  // it lists that folder alone, by design (R3, 13:03): its list opening is the check.
  "calendar.location": {
    probe: { kind: "opens", reach: [{ menu: ["File", "Import from Drive…"] }], scope: "page" },
    expected:
      "its list opens, listing the folder shown and the folders above it (one at a top folder, by design)",
  },
  // Today and a day of this week change nothing while this week is shown: the next week first, from the Week view.
  "calendar.today": {
    probe: {
      kind: "effect",
      reach: [
        { role: "button", name: "Week" },
        { role: "button", name: "Next week" },
      ],
    },
  },
  "calendar.weekday-month-n-n": {
    probe: {
      kind: "effect",
      reach: [
        { role: "button", name: "Week" },
        { role: "button", name: "Next week" },
      ],
    },
  },
  // The Save panel goes on reading the drive after it opens.
  "calendar.hide-the-file-browser": {
    probe: {
      kind: "effect",
      reach: [{ menu: ["File", "Save “Work” to Drive…"] }],
      scope: "page",
      settle: 2_500,
    },
  },
  // The Drive panel opens on Documents, selected already.
  "calendar.documents-2": {
    probe: {
      kind: "select",
      alreadySelected: true,
      reach: [{ menu: ["File", "Import from Drive…"] }],
      scope: "page",
    },
  },
  // A view is named in its arrows' labels, and another row's Month or Year may be what Calendar kept: Week first.
  "calendar.next-week": { probe: { kind: "effect", reach: [{ role: "button", name: "Week" }] } },
  "calendar.previous-week": {
    probe: { kind: "effect", reach: [{ role: "button", name: "Week" }] },
  },
  // Month's grid is no list any more: a grid of days, which choosing Month shows.
  "calendar.events-in-month": { instanceOf: "calendar.month" },
  // Export downloads an .ics file and Import opens the browser's file chooser: calendar-ics-journey drives both.
  "calendar.menu.file.export-work": {
    probe: null,
    journey: [["calendar-ics-journey.mjs", /importing the export again adds nothing/]],
  },
  "calendar.menu.file.import": {
    probe: null,
    journey: [
      ["calendar-ics-journey.mjs", /neither refused file saved anything/],
      ["calendar-ics-journey.mjs", /importing the export again adds nothing/],
    ],
  },
};

export const ROWS = familyRows("calendar", CRAWLED, TUNE);
