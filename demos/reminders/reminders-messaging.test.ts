import { afterEach, describe, expect, it, vi } from "vitest";
import { changeReminderDetail, reminderDetail, remindWhenMessaging } from "./reminders-details";

const REMINDERS = {
  data: {
    reminders: [
      { id: "r1", title: "Ask about the keys" },
      { id: "r2", title: "Finished", completed: true },
      { id: "r3", title: "For someone else" },
    ],
  },
};

const stubServer = () => {
  const notified: unknown[] = [];
  vi.stubGlobal(
    "fetch",
    vi.fn(async (url: string, init?: RequestInit) => {
      if (url.includes("/api/notification-center/notify")) {
        notified.push(JSON.parse(String(init?.body)));
        return new Response("{}", { status: 201 });
      }
      return new Response(JSON.stringify(REMINDERS), { status: 200 });
    }),
  );
  return notified;
};

describe("a reminder for when messaging a person", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("alerts once, for that person's unfinished reminders only", async () => {
    changeReminderDetail("r1", { person: { name: "Ann", to: "ann" } });
    changeReminderDetail("r2", { person: { name: "Ann", to: "ann" } });
    changeReminderDetail("r3", { person: { name: "Bob", to: "bob" } });
    const notified = stubServer();
    await remindWhenMessaging("ann", "Ann Lee");
    expect(notified).toEqual([
      { app: "reminders", title: "Ask about the keys", body: "When messaging Ann Lee" },
    ]);
    expect(reminderDetail("r1").person?.told).toBe(true);
    expect(reminderDetail("r3").person?.told).toBeUndefined();
    await remindWhenMessaging("ann", "Ann Lee");
    expect(notified).toHaveLength(1);
  });

  it("asks nothing when no reminder waits for that person", async () => {
    const notified = stubServer();
    await remindWhenMessaging("nobody", "Nobody");
    expect(notified).toEqual([]);
    expect(fetch).not.toHaveBeenCalled();
  });
});
