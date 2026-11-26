import { describe, expect, it } from "vitest";
import { eventOfOpenItem } from "./calendar-open";

const TOKEN = "0123456789abcdef0123456789abcdef";

describe("the event a request to open an item of Calendar names", () => {
  it("is the event itself for Spotlight, and the alert's event for an alert", () => {
    expect(eventOfOpenItem("lunch")).toBe("lunch");
    expect(eventOfOpenItem("alert:lunch@1700000000000")).toBe("lunch");
    expect(eventOfOpenItem("alert:lunch@1700000000000@1700000300000")).toBe("lunch");
  });

  it("is the invitation's event for an invitation", () => {
    expect(eventOfOpenItem(`invite-${TOKEN}-7`)).toBe(`invitation-${TOKEN}`);
  });

  it("leaves a cancellation and a reply, whose tokens name no event the window holds", () => {
    expect(eventOfOpenItem(`cancel-${TOKEN}-7`)).toBe(`cancel-${TOKEN}-7`);
    expect(eventOfOpenItem(`reply-${TOKEN}-anna-accepted-7`)).toBe(
      `reply-${TOKEN}-anna-accepted-7`,
    );
  });
});
