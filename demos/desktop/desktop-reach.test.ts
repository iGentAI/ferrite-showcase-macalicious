import { afterEach, describe, expect, it, vi } from "vitest";
import { askToReach, onAddressRequest, takeAddressRequests } from "./desktop-reach";

const ada = { app: "messages", to: "ada", name: "Ada" };

describe("asking an application to reach someone", () => {
  afterEach(() => {
    takeAddressRequests("messages");
    takeAddressRequests("mail");
  });

  it("keeps a request until its application takes it, once", () => {
    askToReach(ada);
    expect(takeAddressRequests("mail")).toEqual([]);
    expect(takeAddressRequests("messages")).toEqual([ada]);
    expect(takeAddressRequests("messages")).toEqual([]);
  });

  it("gives one to the open window, once, and not to two", () => {
    const first = vi.fn();
    const second = vi.fn();
    const stopFirst = onAddressRequest("messages", first);
    const stopSecond = onAddressRequest("messages", second);
    askToReach(ada);
    stopFirst();
    stopSecond();
    expect(first).toHaveBeenCalledWith(ada);
    expect(second).not.toHaveBeenCalled();
    expect(takeAddressRequests("messages")).toEqual([]);
  });
});
