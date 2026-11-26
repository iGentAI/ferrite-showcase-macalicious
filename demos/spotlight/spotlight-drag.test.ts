import { afterEach, describe, expect, it, vi } from "vitest";
import type { DataResult } from "./spotlight-desktop";
import { dragItemOf } from "./spotlight-drag";

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

const found = (kind: string, app: string, id: string, title: string) =>
  ({ kind, app, id, title, detail: "" }) as DataResult;
const answering = (body: unknown) =>
  vi.stubGlobal(
    "fetch",
    vi.fn(async () => ({ ok: true, status: 200, json: async () => body })),
  );

describe("a found item dragged out of Spotlight", () => {
  it("is the file itself when it is on the drive", () => {
    expect(dragItemOf(found("files", "finder", "f1", "Soup.rtf"))).toEqual({
      id: "f1",
      name: "Soup.rtf",
      kind: "file",
    });
  });

  it("is a vCard for a contact, written from the stored card", async () => {
    answering({
      cards: [
        {
          id: "c1",
          account: "icloud",
          first: "Ada",
          last: "Byron",
        },
      ],
    });
    const item = dragItemOf(found("contacts", "contacts", "c1", "Ada Byron"));
    expect(item?.name).toBe("Ada Byron.vcf");
    const text = await (await item?.bytes?.())?.text();
    expect(text).toContain("FN:Ada Byron");
  });

  it("is an iCalendar file for an event, written from the stored event", async () => {
    answering({
      events: [
        {
          id: "e1",
          title: "Standup",
          start: 1_800_000_000_000,
          end: 1_800_000_360_000,
          calendar: "work",
        },
      ],
      calendars: [{ id: "work", name: "Work", color: "purple" }],
    });
    const item = dragItemOf(found("events", "calendar", "e1", "Standup"));
    expect(item?.name).toBe("Standup.ics");
    const text = await (await item?.bytes?.())?.text();
    expect(text).toContain("SUMMARY:Standup");
  });

  it("says so when the thing has gone by the time it lands", async () => {
    answering({ cards: [] });
    const item = dragItemOf(found("contacts", "contacts", "gone", "Gone"));
    await expect(item?.bytes?.()).rejects.toThrow("The card is no longer there.");
  });

  it("does not drag what has no file form", () => {
    expect(dragItemOf(found("web", "safari", "https://example.com", "Example"))).toBeNull();
  });
});
