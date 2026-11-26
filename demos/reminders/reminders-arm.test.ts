import { afterEach, describe, expect, it, vi } from "vitest";
import type { Reminder } from "./reminders-data";
import { alertsToArm } from "./reminders-sync";

/*
 * A list taken back from sharing comes back into the person's own document without alerts (the
 * server cannot work instants out). The window asks the server to arm those its due reminders
 * lack, each with the day, minute and zone it was worked out from, so that the server arms only
 * an alert whose reminder still says them.
 */

const NY = "America/New_York";
const list = { id: "home", name: "Home", color: "purple" as const };

describe("the alerts a window asks the server to arm", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("names each due reminder's instant and what it was worked out from, and nothing else", () => {
    const reminders: Reminder[] = [
      {
        id: "call",
        listId: "home",
        title: "Call",
        due: "2026-10-21",
        dueTime: "15:00",
        timeZone: NY,
      },
      { id: "bins", listId: "home", title: "Bins", due: "2026-10-22", timeZone: NY },
      { id: "older", listId: "home", title: "Older", due: "2026-10-22" },
      { id: "done", listId: "home", title: "Done", due: "2026-10-22", completed: true },
      { id: "plain", listId: "home", title: "Plain" },
    ];
    const asked = alertsToArm({ lists: [list], reminders });
    expect(Object.keys(asked).sort()).toEqual(["bins", "call", "older"]);
    expect(asked.call).toEqual({
      at: Date.UTC(2026, 9, 21, 19),
      due: "2026-10-21",
      dueTime: "15:00",
      timeZone: NY,
    });
    // 9:00 on its day, in its zone.
    expect(asked.bins).toEqual({ at: Date.UTC(2026, 9, 22, 13), due: "2026-10-22", timeZone: NY });
    // A reminder that names no zone is worked out in the browser's own, and says so by naming none.
    expect(asked.older).toEqual({ at: new Date(2026, 9, 22, 9).getTime(), due: "2026-10-22" });
  });
});
