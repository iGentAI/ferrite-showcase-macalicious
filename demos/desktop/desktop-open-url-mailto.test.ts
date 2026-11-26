import { afterEach, describe, expect, it } from "vitest";
import { openUrl, takeOpenUrlRequests } from "./desktop-open-url";
import { takeAddressRequests } from "./desktop-reach";

describe("a mailto: link from another application", () => {
  afterEach(() => {
    takeOpenUrlRequests();
    takeAddressRequests("mail");
  });

  it("asks Mail for a new message, not Safari", () => {
    expect(openUrl("mailto:ann%40example.com?subject=Ferry%20times", "notes")).not.toBeNull();
    expect(takeAddressRequests("mail")).toEqual([
      { app: "mail", to: "ann@example.com", name: "ann@example.com", subject: "Ferry times" },
    ]);
    expect(takeOpenUrlRequests()).toEqual([]);
  });

  it("refuses one with no address", () => {
    expect(openUrl("mailto:", "notes")).toBeNull();
    expect(takeAddressRequests("mail")).toEqual([]);
  });
});
