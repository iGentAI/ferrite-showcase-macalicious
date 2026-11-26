import { describe, expect, it } from "vitest";
import {
  bannerFor,
  callRingsThrough,
  groupsFor,
  ruleKey,
  ruleOf,
  ruleSummary,
} from "./notification-rules";

const item = (app: string, title: string, alert = false) => ({ app, title, alert });

describe("an application's notification rule", () => {
  it("allows everything until it is changed", () => {
    expect(ruleOf({}, "mail")).toEqual({
      allow: true,
      style: "default",
      center: true,
      sound: true,
    });
    expect(ruleSummary(ruleOf({}, "mail"))).toBe("Sounds");
  });

  it("reads only that application's keys", () => {
    const values = { [ruleKey("mail", "allow")]: false, [ruleKey("mail", "sound")]: false };
    expect(ruleOf(values, "mail").allow).toBe(false);
    expect(ruleOf(values, "mail").sound).toBe(false);
    expect(ruleOf(values, "messages").allow).toBe(true);
    expect(ruleSummary(ruleOf(values, "mail"))).toBe("Off");
  });

  it("decides what a new item becomes on screen", () => {
    const rule = ruleOf({}, "mail");
    expect(bannerFor(item("mail", "a", true), rule)?.alert).toBe(true);
    expect(bannerFor(item("mail", "a"), { ...rule, allow: false })).toBeNull();
    expect(bannerFor(item("mail", "a"), { ...rule, style: "none" })).toBeNull();
    expect(bannerFor(item("mail", "a"), { ...rule, style: "alerts" })?.alert).toBe(true);
    expect(bannerFor(item("mail", "a", true), { ...rule, style: "banners" })?.alert).toBe(false);
  });
});

describe("a call during Do Not Disturb", () => {
  const call = (title: string, at_ms: number) => ({ app: "facetime", title, at_ms });
  const repeated = { "notifications.allowRepeatedCalls": true };

  it("stays silent unless a setting lets it through", () => {
    expect(callRingsThrough(call("Ada", 0), {})).toBe(false);
    expect(callRingsThrough(call("Ada", 1_000), {})).toBe(false);
    expect(callRingsThrough(call("Bob", 0), { "notifications.allowCalls": true })).toBe(true);
  });

  it("rings on the same person's second call within three minutes, and not after", () => {
    expect(callRingsThrough(call("Grace", 0), repeated)).toBe(false);
    expect(callRingsThrough(call("Linus", 10_000), repeated)).toBe(false);
    expect(callRingsThrough(call("Grace", 180_000), repeated)).toBe(true);
    expect(callRingsThrough(call("Linus", 190_001), repeated)).toBe(false);
  });

  it("takes no older call for a repeat, and keeps the newest it heard", () => {
    expect(callRingsThrough(call("Edsger", 600_000), repeated)).toBe(false);
    expect(callRingsThrough(call("Edsger", 100_000), repeated)).toBe(false);
    expect(callRingsThrough(call("Edsger", 599_000), repeated)).toBe(false);
    expect(callRingsThrough(call("Edsger", 700_000), repeated)).toBe(true);
  });

  it("lets nothing else through", () => {
    expect(
      callRingsThrough(
        { app: "mail", title: "Ada", at_ms: 0 },
        { "notifications.allowCalls": true },
      ),
    ).toBe(false);
  });
});

describe("Notification Center's order", () => {
  const items = [item("messages", "1"), item("calendar", "2"), item("messages", "3")];
  const shape = (order: unknown) =>
    groupsFor(items, order).map(([app, list]) => [app, list.map(({ title }) => title).join()]);

  it("holds an app together by default and for Recents by App", () => {
    const expected = [
      ["messages", "1,3"],
      ["calendar", "2"],
    ];
    expect(shape(undefined)).toEqual(expected);
    expect(shape("Recents by App")).toEqual(expected);
  });

  it("keeps arrival order for Recents", () => {
    expect(shape("Recents")).toEqual([
      ["messages", "1"],
      ["calendar", "2"],
      ["messages", "3"],
    ]);
  });

  it("follows the pane's list for Manually by App", () => {
    expect(shape("Manually by App")).toEqual([
      ["calendar", "2"],
      ["messages", "1,3"],
    ]);
  });
});
